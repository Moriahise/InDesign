#targetengine "session"
/* ============================================================================
 *  HE/EN Spalten-Sync  –  Version 2.0.0
 *  Adobe InDesign 18.1 / ExtendScript (ScriptUI Palette)
 *
 *  Zweck
 *  -----
 *  Zwei parallele Textspalten pro Seite (Hebraeisch / Englisch) auf Gleichlauf
 *  pruefen und bei Bedarf die Rahmenhoehe nachjustieren, damit der Textfluss
 *  beider Sprachen seitenweise zueinander passt.
 *
 *  Neu in 2.0.0
 *  ------------
 *  - OpenAI-Anbindung: Der Absatzabgleich erfolgt wahlweise semantisch anhand
 *    der ersten 3-7 Woerter jedes Absatzes.
 *  - Betriebsarten: Anker (Regex) | Index | Anker + KI-Fallback | reine KI.
 *  - Ergebnis-Cache, Protokoll, Verbindungstest, Konfidenz im Bericht.
 *
 *  Technischer Hinweis zur API
 *  ---------------------------
 *  ExtendScript beherrscht kein TLS, ein direkter HTTPS-Aufruf ist unmoeglich.
 *  Die Anfrage laeuft daher ueber eine Systembruecke:
 *    Windows : app.doScript(VBScript)  -> MSXML2.ServerXMLHTTP
 *    macOS   : app.doScript(AppleScript) -> /usr/bin/curl
 *  Beides laeuft synchron. Request und Response gehen ueber temporaere Dateien,
 *  die unmittelbar nach dem Aufruf geloescht werden.
 * ========================================================================== */

(function () {

/* ------------------------------------------------------------------ Konstanten */

var SCRIPT_NAME = "HE/EN Spalten-Sync";
var VERSION     = "2.0.0";
var SETTINGS_F  = File(Folder.userData + "/HE_EN_ColumnSync.settings.txt");
var CACHE_F     = File(Folder.userData + "/HE_EN_ColumnSync.aicache.txt");

var RE_HEB = /[\u0590-\u05FF\uFB1D-\uFB4F]/;
var RE_LAT = /[A-Za-z\u00C0-\u024F]/;
var IS_WIN = (File.fs === "Windows");

/* ------------------------------------------------------------------ Utilities */

function trim(s) { return String(s).replace(/^[\s\u00A0]+/, "").replace(/[\s\u00A0]+$/, ""); }
function num(v, fb) { var n = parseFloat(String(v).replace(",", ".")); return isNaN(n) ? fb : n; }
function mm(v) { return String(Math.round(v * 10) / 10); }

function inArr(arr, v) {
    for (var i = 0; i < arr.length; i++) { if (arr[i] === v) return i; }
    return -1;
}

function hashStr(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) { h = ((h << 5) + h + s.charCodeAt(i)) & 0x7FFFFFFF; }
    return h.toString(16);
}

/* Masseinheit temporaer auf Millimeter – beeinflusst die Oberflaeche nicht. */
function withMM(fn) {
    var old = app.scriptPreferences.measurementUnit;
    app.scriptPreferences.measurementUnit = MeasurementUnits.MILLIMETERS;
    try { return fn(); }
    finally { app.scriptPreferences.measurementUnit = old; }
}

function scriptOf(txt) {
    var h = 0, l = 0, n = Math.min(txt.length, 400);
    for (var i = 0; i < n; i++) {
        var c = txt.charAt(i);
        if (RE_HEB.test(c)) h++;
        else if (RE_LAT.test(c)) l++;
    }
    if (h === 0 && l === 0) return { tag: "-", heb: 0 };
    var r = h / (h + l);
    return { tag: (r >= 0.5 ? "HEB" : (l > 0 ? "LAT" : "-")), heb: r };
}

function snippet(txt, n) {
    var s = String(txt).replace(/[\r\n\u2028\u2029\t]/g, " ").replace(/\s+/g, " ");
    s = trim(s);
    return s.length > n ? s.substr(0, n) + "\u2026" : s;
}

/* Absatzanfang: die ersten n Woerter, Nikud/Teamim und Richtungszeichen entfernt */
function openingText(t, n) {
    var s = String(t)
        .replace(/[\u0591-\u05C7]/g, "")
        .replace(/[\u200E\u200F\u202A-\u202E\uFEFF]/g, "")
        .replace(/[\r\n\u2028\u2029\t]/g, " ");
    s = trim(s.replace(/\s+/g, " "));
    if (s === "") return "";
    var parts = s.split(" "), out = [];
    for (var i = 0; i < parts.length && out.length < n; i++) {
        if (parts[i] !== "") out.push(parts[i]);
    }
    return out.join(" ");
}

function readUTF8(f) {
    try {
        if (!f.exists) return "";
        f.encoding = "UTF-8";
        f.open("r");
        var s = f.read();
        f.close();
        return s;
    } catch (e) { return ""; }
}

function writeUTF8(f, s) {
    try {
        f.encoding = "UTF-8";
        f.lineFeed = "Unix";
        f.open("w");
        f.write(s);
        f.close();
        return true;
    } catch (e) { return false; }
}

function killFile(f) { try { if (f && f.exists) f.remove(); } catch (e) {} }

/* ------------------------------------------------------------------ JSON */
/* ExtendScript kennt kein JSON-Objekt. Minimale, vollstaendige Implementierung.
   Der Encoder maskiert alles ausserhalb ASCII als \uXXXX – dadurch ist die
   Anfrage unabhaengig von jeder Dateikodierung transportsicher.              */

var JSONX = (function () {

    function encStr(s) {
        var out = '"', i, c, code;
        for (i = 0; i < s.length; i++) {
            c = s.charAt(i); code = s.charCodeAt(i);
            if (c === '"') out += '\\"';
            else if (c === "\\") out += "\\\\";
            else if (c === "\n") out += "\\n";
            else if (c === "\r") out += "\\r";
            else if (c === "\t") out += "\\t";
            else if (code < 0x20 || code > 0x7E) {
                var h = code.toString(16);
                while (h.length < 4) h = "0" + h;
                out += "\\u" + h;
            } else out += c;
        }
        return out + '"';
    }

    function enc(v) {
        var i, parts;
        if (v === null || v === undefined) return "null";
        if (typeof v === "number") return isFinite(v) ? String(v) : "null";
        if (typeof v === "boolean") return v ? "true" : "false";
        if (typeof v === "string") return encStr(v);
        if (v instanceof Array) {
            parts = [];
            for (i = 0; i < v.length; i++) parts.push(enc(v[i]));
            return "[" + parts.join(",") + "]";
        }
        parts = [];
        for (var k in v) {
            if (!v.hasOwnProperty(k)) continue;
            if (typeof v[k] === "function") continue;
            parts.push(encStr(String(k)) + ":" + enc(v[k]));
        }
        return "{" + parts.join(",") + "}";
    }

    function dec(text) {
        var s = String(text), p = 0;

        function err(m) { throw new Error("JSON " + m + " @ " + p); }
        function ws() { while (p < s.length && " \t\r\n".indexOf(s.charAt(p)) >= 0) p++; }

        function val() {
            ws();
            var c = s.charAt(p);
            if (c === "{") return obj();
            if (c === "[") return arr();
            if (c === '"') return str();
            if (c === "-" || (c >= "0" && c <= "9")) return nbr();
            if (s.substr(p, 4) === "true")  { p += 4; return true; }
            if (s.substr(p, 5) === "false") { p += 5; return false; }
            if (s.substr(p, 4) === "null")  { p += 4; return null; }
            err("unerwartet '" + c + "'");
        }

        function obj() {
            var o = {}; p++; ws();
            if (s.charAt(p) === "}") { p++; return o; }
            for (;;) {
                ws();
                if (s.charAt(p) !== '"') err("Schluessel erwartet");
                var k = str(); ws();
                if (s.charAt(p) !== ":") err("':' erwartet");
                p++;
                o[k] = val(); ws();
                if (s.charAt(p) === ",") { p++; continue; }
                if (s.charAt(p) === "}") { p++; return o; }
                err("',' oder '}' erwartet");
            }
        }

        function arr() {
            var a = []; p++; ws();
            if (s.charAt(p) === "]") { p++; return a; }
            for (;;) {
                a.push(val()); ws();
                if (s.charAt(p) === ",") { p++; continue; }
                if (s.charAt(p) === "]") { p++; return a; }
                err("',' oder ']' erwartet");
            }
        }

        function str() {
            var out = ""; p++;
            while (p < s.length) {
                var c = s.charAt(p++);
                if (c === '"') return out;
                if (c !== "\\") { out += c; continue; }
                var e = s.charAt(p++);
                if (e === "u") { out += String.fromCharCode(parseInt(s.substr(p, 4), 16)); p += 4; }
                else if (e === "n") out += "\n";
                else if (e === "t") out += "\t";
                else if (e === "r") out += "\r";
                else if (e === "b") out += "\b";
                else if (e === "f") out += "\f";
                else out += e;
            }
            err("Zeichenkette nicht geschlossen");
        }

        function nbr() {
            var st = p;
            if (s.charAt(p) === "-") p++;
            while (p < s.length && "0123456789.eE+-".indexOf(s.charAt(p)) >= 0) p++;
            return parseFloat(s.substring(st, p));
        }

        var r = val(); ws();
        return r;
    }

    return { stringify: enc, parse: dec };
})();

/* ------------------------------------------------------------------ Protokoll */

var LOG = [];
function logAdd(line) {
    var t = new Date();
    function z(n) { return (n < 10 ? "0" : "") + n; }
    LOG.push(z(t.getHours()) + ":" + z(t.getMinutes()) + ":" + z(t.getSeconds()) + "  " + line);
    if (LOG.length > 400) LOG.shift();
    if (typeof UI_LOG_SYNC === "function") UI_LOG_SYNC();
}
var UI_LOG_SYNC = null;

/* ------------------------------------------------------------------ HTTP-Bruecke */

function vbq(s) { return String(s).replace(/"/g, '""'); }
function shq(s) { return String(s).replace(/'/g, "'\\''"); }

/*  Sendet einen POST mit JSON-Body und gibt { status, body, error } zurueck. */
function httpPostJSON(url, apiKey, org, bodyStr, timeoutSec, proxy) {
    var base = Folder.temp.fsName + (IS_WIN ? "\\" : "/");
    var stamp = String(new Date().getTime());
    var fReq = File(base + "heen_req_" + stamp + ".json");
    var fRes = File(base + "heen_res_" + stamp + ".json");
    var fSta = File(base + "heen_sta_" + stamp + ".txt");
    var fScr = File(base + "heen_call_" + stamp + (IS_WIN ? ".vbs" : ".sh"));

    var out = { status: 0, body: "", error: "" };

    try {
        if (!writeUTF8(fReq, bodyStr)) { out.error = "Temp-Datei nicht schreibbar."; return out; }
        killFile(fRes); killFile(fSta);

        if (IS_WIN) {
            var vbs = [];
            vbs.push('On Error Resume Next');
            vbs.push('Dim sIn, body, http, oB, oT, st');
            vbs.push('Set sIn = CreateObject("ADODB.Stream")');
            vbs.push('sIn.Type = 2');
            vbs.push('sIn.Charset = "utf-8"');
            vbs.push('sIn.Open');
            vbs.push('sIn.LoadFromFile "' + vbq(fReq.fsName) + '"');
            vbs.push('body = sIn.ReadText');
            vbs.push('sIn.Close');
            vbs.push('Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")');
            if (trim(proxy) !== "") vbs.push('http.setProxy 2, "' + vbq(proxy) + '"');
            var ms = Math.max(5, timeoutSec) * 1000;
            vbs.push('http.setTimeouts 10000, 20000, 30000, ' + ms);
            vbs.push('http.open "POST", "' + vbq(url) + '", False');
            vbs.push('http.setRequestHeader "Content-Type", "application/json"');
            vbs.push('http.setRequestHeader "Authorization", "Bearer ' + vbq(apiKey) + '"');
            if (trim(org) !== "") vbs.push('http.setRequestHeader "OpenAI-Organization", "' + vbq(org) + '"');
            vbs.push('http.send body');
            vbs.push('st = "0"');
            vbs.push('If Err.Number = 0 Then st = CStr(http.status)');
            vbs.push('Set oB = CreateObject("ADODB.Stream")');
            vbs.push('oB.Type = 1');
            vbs.push('oB.Open');
            vbs.push('If Err.Number = 0 Then oB.Write http.responseBody');
            vbs.push('oB.SaveToFile "' + vbq(fRes.fsName) + '", 2');
            vbs.push('oB.Close');
            vbs.push('Set oT = CreateObject("ADODB.Stream")');
            vbs.push('oT.Type = 2');
            vbs.push('oT.Charset = "utf-8"');
            vbs.push('oT.Open');
            vbs.push('oT.WriteText st & "|" & CStr(Err.Number) & "|" & Err.Description');
            vbs.push('oT.SaveToFile "' + vbq(fSta.fsName) + '", 2');
            vbs.push('oT.Close');
            writeUTF8(fScr, vbs.join("\r\n"));
            app.doScript(fScr, ScriptLanguage.VISUAL_BASIC);
        } else {
            var sh = [];
            sh.push("#!/bin/sh");
            sh.push("CODE=$(/usr/bin/curl -sS --max-time " + Math.max(5, timeoutSec) +
                    " -o '" + shq(fRes.fsName) + "'" +
                    " -w '%{http_code}'" +
                    " -X POST '" + shq(url) + "'" +
                    " -H 'Content-Type: application/json'" +
                    " -H 'Authorization: Bearer " + shq(apiKey) + "'" +
                    (trim(org) !== "" ? " -H 'OpenAI-Organization: " + shq(org) + "'" : "") +
                    " --data-binary @'" + shq(fReq.fsName) + "' 2>/dev/null)");
            sh.push("printf '%s|0|' \"$CODE\" > '" + shq(fSta.fsName) + "'");
            writeUTF8(fScr, sh.join("\n"));
            app.doScript('do shell script "/bin/sh \'' + fScr.fsName.replace(/'/g, "'\\\\''") + '\'"',
                         ScriptLanguage.APPLESCRIPT_LANGUAGE);
        }

        var sta = trim(readUTF8(fSta));
        if (sta === "") { out.error = "Keine Antwort der Systembruecke (Skriptausfuehrung blockiert?)."; }
        else {
            var pp = sta.split("|");
            out.status = parseInt(pp[0], 10) || 0;
            if (pp.length > 1 && pp[1] !== "0" && pp[1] !== "") {
                out.error = "Systemfehler " + pp[1] + ": " + (pp[2] || "");
            }
        }
        out.body = readUTF8(fRes);
    } catch (e) {
        out.error = String(e);
    } finally {
        killFile(fReq); killFile(fRes); killFile(fSta); killFile(fScr);
    }
    return out;
}

/* ------------------------------------------------------------------ Einstellungen */

function defaults() {
    return {
        ident: {
            mode: "pos",          /* pos | style | layer | label | name | script */
            tolMm: 5,
            mirror: true,
            hebThreshold: 0.30,
            he: null,
            en: null
        },
        filter: { minW: 20, minH: 20, minChars: 20, skipNumeric: true, skipLocked: true },
        range:  { mode: "doc", text: "" },
        match:  { mode: "anchor",          /* anchor | index | hybrid | ai */
                  words: 5,                /* 3-7 Woerter fuer den Abgleich */
                  useRegex: true,
                  regex: "^\\s*([0-9]{1,4})",
                  offset: 0,
                  window: 25 },
        ai:     { endpoint: "https://api.openai.com/v1/chat/completions",
                  model: "gpt-4o-mini",
                  apiKey: "",
                  storeKey: false,
                  useEnv: true,
                  org: "",
                  proxy: "",
                  timeout: 120,
                  sendTemp: true,
                  block: 30,          /* Absaetze je Anfrage */
                  overlap: 4,
                  minConf: 0.6,
                  maxReq: 200,
                  useCache: true },
        fix:    { master: "he", minH: 40, maxH: 260, step: 1.0, maxIter: 60,
                  anchorEdge: "top", tolPara: 0 }
    };
}

var S = defaults();

function apiKey() {
    if (S.ai.useEnv) {
        var k = "";
        try { k = $.getenv("OPENAI_API_KEY") || ""; } catch (e) {}
        if (trim(k) !== "") return trim(k);
    }
    if (trim(S.ai.apiKey) !== "") return trim(S.ai.apiKey);
    if ($.global.__HEEN_KEY) return String($.global.__HEEN_KEY);
    return "";
}

function keyStatus() {
    var k = apiKey();
    if (k === "") return "kein Schl\u00fcssel gesetzt";
    var src = "Sitzung";
    try { if (S.ai.useEnv && trim($.getenv("OPENAI_API_KEY") || "") !== "") src = "Umgebungsvariable"; } catch (e) {}
    if (src === "Sitzung" && trim(S.ai.apiKey) !== "") src = "Einstellungsdatei";
    return "gesetzt (" + src + ", \u2026" + k.substr(Math.max(0, k.length - 4)) + ")";
}

function saveSettings() {
    try {
        var keep = S.ai.apiKey;
        if (!S.ai.storeKey) S.ai.apiKey = "";
        SETTINGS_F.encoding = "UTF-8";
        SETTINGS_F.open("w");
        SETTINGS_F.write(S.toSource());
        SETTINGS_F.close();
        S.ai.apiKey = keep;
        return true;
    } catch (e) { return false; }
}

function loadSettings() {
    try {
        if (!SETTINGS_F.exists) return false;
        var src = readUTF8(SETTINGS_F);
        var o = eval(src);
        if (o && o.ident && o.match) {
            var d = defaults();
            /* fehlende Abschnitte aus den Vorgaben ergaenzen (Aufwaertskompatibilitaet) */
            for (var k in d) { if (!o[k]) o[k] = d[k]; else {
                for (var k2 in d[k]) { if (o[k][k2] === undefined) o[k][k2] = d[k][k2]; }
            } }
            S = o;
            return true;
        }
    } catch (e) {}
    return false;
}

/* ------------------------------------------------------------------ KI-Cache */

var AI_CACHE = null;

function cacheLoad() {
    if (AI_CACHE) return AI_CACHE;
    AI_CACHE = {};
    var txt = readUTF8(CACHE_F);
    if (txt === "") return AI_CACHE;
    var lines = txt.split("\n");
    for (var i = 0; i < lines.length; i++) {
        var t = lines[i].indexOf("\t");
        if (t > 0) AI_CACHE[lines[i].substring(0, t)] = lines[i].substring(t + 1);
    }
    return AI_CACHE;
}

function cacheSave() {
    if (!AI_CACHE) return;
    var out = [];
    for (var k in AI_CACHE) { if (AI_CACHE.hasOwnProperty(k)) out.push(k + "\t" + AI_CACHE[k]); }
    writeUTF8(CACHE_F, out.join("\n"));
}

function cacheClear() { AI_CACHE = {}; killFile(CACHE_F); }

function cacheCount() { var n = 0, c = cacheLoad(); for (var k in c) { if (c.hasOwnProperty(k)) n++; } return n; }

/* ------------------------------------------------------------------ OpenAI-Client */

var AI_STAT = { req: 0, cached: 0, fail: 0, ms: 0 };

function aiChat(sysMsg, userMsg) {
    var key = apiKey();
    if (key === "") return { ok: false, error: "Kein API-Schl\u00fcssel hinterlegt." };

    var body = {
        model: S.ai.model,
        messages: [{ role: "system", content: sysMsg },
                   { role: "user",   content: userMsg }],
        response_format: { type: "json_object" }
    };
    if (S.ai.sendTemp) body.temperature = 0;

    var t0 = new Date().getTime();
    var r = httpPostJSON(S.ai.endpoint, key, S.ai.org, JSONX.stringify(body), S.ai.timeout, S.ai.proxy);
    var dt = new Date().getTime() - t0;
    AI_STAT.req++; AI_STAT.ms += dt;

    if (r.error !== "" && r.status === 0) {
        AI_STAT.fail++;
        logAdd("FEHLER Bruecke: " + r.error);
        return { ok: false, error: r.error };
    }
    if (r.status < 200 || r.status >= 300) {
        AI_STAT.fail++;
        var msg = "HTTP " + r.status;
        try {
            var eo = JSONX.parse(r.body);
            if (eo && eo.error && eo.error.message) msg += " \u2013 " + eo.error.message;
        } catch (e) { msg += " \u2013 " + snippet(r.body, 200); }
        logAdd("FEHLER " + msg);
        return { ok: false, error: msg };
    }

    var data;
    try { data = JSONX.parse(r.body); }
    catch (e) { AI_STAT.fail++; logAdd("FEHLER Antwort unlesbar: " + snippet(r.body, 200)); return { ok: false, error: "Antwort nicht lesbar." }; }

    var content = "";
    try { content = data.choices[0].message.content; } catch (e) {}
    if (!content) { AI_STAT.fail++; return { ok: false, error: "Leere Antwort." }; }

    var usage = "";
    try { if (data.usage) usage = " | Token " + data.usage.prompt_tokens + "+" + data.usage.completion_tokens; } catch (e) {}
    logAdd("OK " + dt + " ms" + usage + " | " + snippet(content, 90));

    return { ok: true, content: content, ms: dt };
}

function aiTest() {
    var r = aiChat('Antworte ausschliesslich mit JSON.',
                   'Gib exakt zurueck: {"ok":true}');
    if (!r.ok) return r;
    var o = null;
    try { o = JSONX.parse(r.content); } catch (e) {}
    return { ok: !!(o && o.ok), error: (o && o.ok) ? "" : "Unerwartete Antwort: " + snippet(r.content, 120), ms: r.ms };
}

/* ------------------------------------------------------------------ Seitenbereich */

function parseRange(doc, spec) {
    var out = [], parts = String(spec).split(","), i, j;
    var names = [];
    for (i = 0; i < doc.pages.length; i++) { names.push(String(doc.pages[i].name)); }

    function findByName(nm) {
        var k = inArr(names, String(nm));
        if (k >= 0) return k;
        var n = parseInt(nm, 10);
        if (!isNaN(n) && n >= 1 && n <= doc.pages.length) return n - 1;
        return -1;
    }

    for (i = 0; i < parts.length; i++) {
        var p = trim(parts[i]);
        if (p === "") continue;
        var m = p.match(/^(.+?)\s*-\s*(.*)$/);
        if (m) {
            var a = findByName(trim(m[1]));
            var b = (trim(m[2]) === "") ? doc.pages.length - 1 : findByName(trim(m[2]));
            if (a < 0) continue;
            if (b < 0) b = doc.pages.length - 1;
            if (b < a) { var t = a; a = b; b = t; }
            for (j = a; j <= b; j++) { if (inArr(out, j) < 0) out.push(j); }
        } else {
            var k = findByName(p);
            if (k >= 0 && inArr(out, k) < 0) out.push(k);
        }
    }
    out.sort(function (x, y) { return x - y; });
    var res = [];
    for (i = 0; i < out.length; i++) { res.push(doc.pages[out[i]]); }
    return res;
}

function resolvePages(doc) {
    var i, res = [];
    switch (S.range.mode) {
    case "current":
        if (app.activeWindow instanceof LayoutWindow) res.push(app.activeWindow.activePage);
        break;
    case "spread":
        if (app.activeWindow instanceof LayoutWindow) {
            var sp = app.activeWindow.activeSpread;
            for (i = 0; i < sp.pages.length; i++) res.push(sp.pages[i]);
        }
        break;
    case "selection":
        var seen = [];
        for (i = 0; i < app.selection.length; i++) {
            try {
                var pg = app.selection[i].parentPage;
                if (pg && pg.isValid && inArr(seen, pg.id) < 0) { seen.push(pg.id); res.push(pg); }
            } catch (e) {}
        }
        res.sort(function (a, b) { return a.documentOffset - b.documentOffset; });
        break;
    case "range":
        res = parseRange(doc, S.range.text);
        break;
    default:
        for (i = 0; i < doc.pages.length; i++) res.push(doc.pages[i]);
    }
    return res;
}

/* ------------------------------------------------------------------ Rahmen-Scan */

function pageRel(tf, page) {
    var pb = page.bounds, gb = tf.geometricBounds;
    return { x: gb[1] - pb[1], y: gb[0] - pb[0],
             w: gb[3] - gb[1], h: gb[2] - gb[0],
             pw: pb[3] - pb[1],
             side: (page.side === PageSideOptions.LEFT_HAND) ? "L" : "R" };
}

function frameInfo(tf, page) {
    var o = { frame: tf, page: page, role: "", excluded: false, reason: "" };
    var r = pageRel(tf, page);
    o.x = r.x; o.y = r.y; o.w = r.w; o.h = r.h; o.pw = r.pw; o.side = r.side;

    try { o.layer = tf.itemLayer.name; } catch (e) { o.layer = "?"; }
    try { o.objStyle = tf.appliedObjectStyle.name; } catch (e) { o.objStyle = "?"; }
    try { o.label = tf.label; } catch (e) { o.label = ""; }
    try { o.name = tf.name; } catch (e) { o.name = ""; }
    try { o.locked = tf.locked; } catch (e) { o.locked = false; }
    try { o.overflows = tf.overflows; } catch (e) { o.overflows = false; }

    var txt = "";
    try { txt = tf.texts[0].contents; } catch (e) { txt = ""; }
    if (txt instanceof Array) txt = txt.join("");
    o.chars = txt.length;
    o.text  = txt;
    var sc = scriptOf(txt);
    o.script = sc.tag;
    o.hebRatio = sc.heb;

    try { o.storyId = tf.parentStory.id; } catch (e) { o.storyId = -1; }
    try { o.threaded = !!(tf.previousTextFrame || tf.nextTextFrame); } catch (e) { o.threaded = false; }

    var f = S.filter;
    if (o.w < f.minW)      { o.excluded = true; o.reason = "Breite"; }
    else if (o.h < f.minH) { o.excluded = true; o.reason = "H\u00f6he"; }
    else if (o.chars < f.minChars) { o.excluded = true; o.reason = "Zeichen"; }
    else if (f.skipLocked && o.locked) { o.excluded = true; o.reason = "gesperrt"; }
    else if (f.skipNumeric && /^[\s0-9ivxlcIVXLC.,\u2013\u2014-]*$/.test(trim(txt))) {
        o.excluded = true; o.reason = "nur Ziffern";
    }
    return o;
}

function scanPage(page) {
    return withMM(function () {
        var items = page.allPageItems, out = [], i;
        for (i = 0; i < items.length; i++) {
            if (items[i] instanceof TextFrame) {
                try { out.push(frameInfo(items[i], page)); } catch (e) {}
            }
        }
        out.sort(function (a, b) { return (a.y - b.y) || (a.x - b.x); });
        for (i = 0; i < out.length; i++) { out[i].no = i + 1; }
        return out;
    });
}

/* ------------------------------------------------------------------ Rollen-Regel */

function refFromInfo(info) {
    switch (S.ident.mode) {
    case "style":  return { v: info.objStyle };
    case "layer":  return { v: info.layer };
    case "label":  return { v: info.label };
    case "name":   return { v: info.name };
    case "script": return { v: (info.hebRatio >= S.ident.hebThreshold) ? "HEB" : "LAT" };
    default:       return { x: info.x, y: info.y, w: info.w, h: info.h, pw: info.pw, side: info.side };
    }
}

function refLabel(ref) {
    if (!ref) return "\u2013 nicht gesetzt \u2013";
    if (S.ident.mode === "pos") {
        return "X " + mm(ref.x) + " / Y " + mm(ref.y) + " / B " + mm(ref.w) +
               " / H " + mm(ref.h) + " mm (Seite " + ref.side + ")";
    }
    return String(ref.v === "" ? "<leer>" : ref.v);
}

function matchRole(info, ref) {
    if (!ref) return false;
    var m = S.ident.mode;
    if (m === "pos") {
        var t = S.ident.tolMm, rx = ref.x;
        if (S.ident.mirror && ref.side !== info.side) rx = ref.pw - (ref.x + ref.w);
        return Math.abs(info.x - rx) <= t &&
               Math.abs(info.y - ref.y) <= t &&
               Math.abs(info.w - ref.w) <= t;
    }
    if (m === "script") {
        var isHeb = (info.hebRatio >= S.ident.hebThreshold);
        return (ref.v === "HEB") ? isHeb : !isHeb;
    }
    var val = (m === "style") ? info.objStyle :
              (m === "layer") ? info.layer :
              (m === "label") ? info.label : info.name;
    return String(val).toLowerCase() === String(ref.v).toLowerCase();
}

function pickRole(list, ref) {
    var best = null;
    for (var i = 0; i < list.length; i++) {
        if (list[i].excluded || !matchRole(list[i], ref)) continue;
        if (!best || list[i].chars > best.chars) best = list[i];
    }
    return best;
}

function framesForPage(page) {
    var list = scanPage(page);
    return { list: list, he: pickRole(list, S.ident.he), en: pickRole(list, S.ident.en) };
}

/* ------------------------------------------------------------------ Absatzkarte */

function storyMap(story, cache) {
    var id = story.id;
    if (cache[id]) return cache[id];

    var c = story.paragraphs.everyItem().contents;
    if (!(c instanceof Array)) c = [c];

    var starts = [], pos = 0, i;
    for (i = 0; i < c.length; i++) { starts.push(pos); pos += c[i].length; }

    var map = { starts: starts, texts: c, total: pos, exact: true, keys: null, open: null };
    try { map.exact = (pos === story.characters.length); } catch (e) {}
    cache[id] = map;
    return map;
}

function paraAt(map, charIndex) {
    var lo = 0, hi = map.starts.length - 1, mid;
    if (hi < 0) return -1;
    if (charIndex <= 0) return 0;
    while (lo < hi) {
        mid = Math.ceil((lo + hi) / 2);
        if (map.starts[mid] <= charIndex) lo = mid; else hi = mid - 1;
    }
    return lo;
}

function frameTopPara(tf, map) {
    var t;
    try { t = tf.texts[0]; } catch (e) { return -1; }
    var n = 0;
    try { n = t.characters.length; } catch (e) { return -1; }
    if (n === 0) return -1;
    var first;
    try { first = t.characters[0].index; } catch (e) { return -1; }
    return paraAt(map, first);
}

/* ------------------------------------------------------------------ Anker (Regex) */

function normWords(t, n) {
    var s = String(t)
        .replace(/[\u0591-\u05C7]/g, "")
        .replace(/[\u200E\u200F\u202A-\u202E\uFEFF]/g, "")
        .replace(/[^0-9A-Za-z\u00C0-\u024F\u0590-\u05FF]+/g, " ");
    s = trim(s).toLowerCase();
    if (s === "") return "";
    var parts = s.split(" "), out = [];
    for (var i = 0; i < parts.length && i < n; i++) { if (parts[i] !== "") out.push(parts[i]); }
    return out.join(" ");
}

function makeKey(t) {
    if (S.match.useRegex && trim(S.match.regex) !== "") {
        try {
            var re = new RegExp(S.match.regex);
            var m = re.exec(String(t));
            if (m) return (m.length > 1 && m[1] !== undefined) ? String(m[1]) : String(m[0]);
        } catch (e) {}
        return null;
    }
    var k = normWords(t, S.match.words);
    return (k === "") ? null : k;
}

function keysOf(map) {
    if (map.keys) return map.keys;
    var k = [];
    for (var i = 0; i < map.texts.length; i++) { k.push(makeKey(map.texts[i])); }
    map.keys = k;
    return k;
}

function openingsOf(map, words) {
    if (map.open && map.openW === words) return map.open;
    var o = [];
    for (var i = 0; i < map.texts.length; i++) { o.push(openingText(map.texts[i], words)); }
    map.open = o; map.openW = words;
    return o;
}

function findKey(arr, key, from, window) {
    if (key === null) return -1;
    var to = Math.min(arr.length, from + window);
    for (var i = from; i < to; i++) { if (arr[i] === key) return i; }
    return -1;
}

/* ------------------------------------------------------------------ KI-Ausrichtung */

var AI_SYS =
 "Du richtest zweisprachige Paralleltexte aus (Hebraeisch und Englisch). " +
 "Du bekommst zwei nummerierte Listen von Absatzanfaengen; jeder Eintrag enthaelt nur " +
 "die ersten Woerter des jeweiligen Absatzes. Ordne einander inhaltlich entsprechende " +
 "Absaetze zu.\n" +
 "Regeln:\n" +
 "1. Die Zuordnung ist streng monoton steigend: spaetere HE-Nummern gehoeren zu spaeteren EN-Nummern.\n" +
 "2. Jede Nummer darf hoechstens einmal vorkommen.\n" +
 "3. Nicht jeder Absatz hat eine Entsprechung. Lass unsichere Faelle weg.\n" +
 "4. Nutze Zahlen, Eigennamen, Zitatanfaenge und Ueberschriften als staerkste Signale.\n" +
 "5. c ist deine Sicherheit von 0 bis 1.\n" +
 "Antworte ausschliesslich mit JSON in genau dieser Form, ohne weiteren Text:\n" +
 '{"pairs":[{"he":0,"en":0,"c":0.9}]}';

function aiPairBlock(heList, enList) {
    /* heList/enList: Arrays von [globalerIndex, "Absatzanfang"] */
    var payload = { he: heList, en: enList };
    var userMsg = JSONX.stringify(payload);
    var ck = null;

    if (S.ai.useCache) {
        ck = hashStr(S.ai.model + "|" + S.match.words + "|" + userMsg);
        var c = cacheLoad();
        if (c[ck]) {
            AI_STAT.cached++;
            try { return { ok: true, pairs: JSONX.parse(c[ck]).pairs || [] }; } catch (e) {}
        }
    }

    var r = aiChat(AI_SYS, userMsg);
    if (!r.ok) return { ok: false, error: r.error, pairs: [] };

    var o;
    try { o = JSONX.parse(r.content); }
    catch (e) { return { ok: false, error: "JSON der Antwort unlesbar.", pairs: [] }; }
    var pairs = (o && o.pairs instanceof Array) ? o.pairs : [];

    if (S.ai.useCache && ck) { cacheLoad()[ck] = JSONX.stringify({ pairs: pairs }); }
    return { ok: true, pairs: pairs };
}

/* Prueft Monotonie und Wertebereich, verwirft alles Unplausible. */
function sanitizePairs(pairs, heLo, heHi, enLo, enHi, minC) {
    var ok = [], lastH = -1, lastE = -1;
    for (var i = 0; i < pairs.length; i++) {
        var p = pairs[i];
        if (!p) continue;
        var h = parseInt(p.he, 10), e = parseInt(p.en, 10);
        var c = (p.c === undefined) ? 1 : parseFloat(p.c);
        if (isNaN(h) || isNaN(e)) continue;
        if (h < heLo || h > heHi || e < enLo || e > enHi) continue;
        if (isNaN(c) || c < minC) continue;
        if (h <= lastH || e <= lastE) continue;
        ok.push({ he: h, en: e, c: c });
        lastH = h; lastE = e;
    }
    return ok;
}

/*  Vollstaendige KI-Ausrichtung eines Absatzbereichs.
    Liefert { h2e, conf, ok, error } fuer heFrom..heTo / enFrom..enTo         */
function aiAlignRange(heOpen, enOpen, heFrom, heTo, enFrom, enTo, prog) {
    var h2e = {}, conf = {};
    var a = heFrom, b = enFrom, guard = 0;
    var blk = Math.max(5, S.ai.block);
    var ov  = Math.max(0, Math.min(S.ai.overlap, blk - 2));
    var err = "";

    while (a <= heTo && b <= enTo) {
        if (AI_STAT.req >= S.ai.maxReq) { err = "Anfragelimit erreicht."; break; }
        if (prog && prog.cancelled()) { err = "Abgebrochen."; break; }
        if (++guard > 5000) { err = "Schutzabbruch."; break; }

        var hHi = Math.min(heTo, a + blk - 1);
        var eHi = Math.min(enTo, b + blk - 1);

        var hl = [], el = [], i;
        for (i = a; i <= hHi; i++) hl.push([i, heOpen[i]]);
        for (i = b; i <= eHi; i++) el.push([i, enOpen[i]]);

        if (prog) prog.step(a - heFrom, heTo - heFrom + 1,
                            "Absatz " + (a + 1) + " \u2026 " + (hHi + 1));

        var r = aiPairBlock(hl, el);
        if (!r.ok) { err = r.error; break; }

        var good = sanitizePairs(r.pairs, a, hHi, b, eHi, S.ai.minConf);

        if (good.length === 0) {
            /* Kein verwertbares Ergebnis: Block 1:1 annehmen und weiterruecken. */
            var n = Math.min(hHi - a, eHi - b);
            for (i = 0; i <= n; i++) { h2e[a + i] = b + i; conf[a + i] = 0; }
            a = a + n + 1; b = b + n + 1;
            continue;
        }

        for (i = 0; i < good.length; i++) { h2e[good[i].he] = good[i].en; conf[good[i].he] = good[i].c; }

        var lastH = good[good.length - 1].he;
        var lastE = good[good.length - 1].en;

        /* Ueberlappung: die letzten Absaetze erneut anbieten, damit an der
           Blockgrenze kein Bruch entsteht. Erneute Paare ueberschreiben sich. */
        var nextA = lastH + 1 - ov;
        var nextB = lastE + 1 - ov;
        if (nextA <= a) nextA = a + 1;
        if (nextB <= b) nextB = b + 1;
        a = nextA; b = nextB;
    }
    return { h2e: h2e, conf: conf, ok: (err === ""), error: err };
}

/* ------------------------------------------------------------------ Zuordnung */

function pairLookup(arr, idx) {
    if (idx < 0) return -1;
    for (var i = idx; i >= 0; i--) { if (arr[i] >= 0) return arr[i] + (idx - i); }
    for (var j = idx; j < arr.length; j++) { if (arr[j] >= 0) return arr[j] - (j - idx); }
    return -1;
}

function emptyPair(nHe, nEn) {
    var h2e = [], conf = [], i;
    for (i = 0; i < nHe; i++) { h2e.push(-1); conf.push(-1); }
    return { h2e: h2e, conf: conf, anchors: 0, ai: 0, note: "" };
}

function pairIndex(heMap, enMap) {
    var res = emptyPair(heMap.starts.length, enMap.starts.length);
    var off = S.match.offset, nEn = enMap.starts.length;
    for (var i = 0; i < res.h2e.length; i++) {
        var j = i + off;
        if (j >= 0 && j < nEn) { res.h2e[i] = j; res.conf[i] = 1; }
    }
    res.note = "Index-Kopplung, Versatz " + off;
    return res;
}

function pairAnchor(heMap, enMap) {
    var nHe = heMap.starts.length, nEn = enMap.starts.length;
    var res = emptyPair(nHe, nEn);
    var hk = keysOf(heMap), ek = keysOf(enMap);
    var w = S.match.window, a = 0, b = 0;

    while (a < nHe && b < nEn) {
        if (hk[a] !== null && hk[a] === ek[b]) {
            res.h2e[a] = b; res.conf[a] = 1; res.anchors++; a++; b++; continue;
        }
        var f1 = findKey(ek, hk[a], b + 1, w);
        var f2 = findKey(hk, ek[b], a + 1, w);
        if (f1 >= 0 && (f2 < 0 || (f1 - b) <= (f2 - a))) { b = f1; continue; }
        if (f2 >= 0) { a = f2; continue; }
        res.h2e[a] = b; res.conf[a] = 0; a++; b++;
    }
    res.note = res.anchors + " Anker gefunden";
    return res;
}

/* Verbleibende Luecken zwischen gesicherten Ankern per KI schliessen. */
function fillGapsWithAI(res, heMap, enMap, prog, onlyUnsure) {
    var nHe = heMap.starts.length, nEn = enMap.starts.length;
    var heOpen = openingsOf(heMap, S.match.words);
    var enOpen = openingsOf(enMap, S.match.words);

    /* gesicherte Stuetzstellen sammeln */
    var anch = [], i;
    for (i = 0; i < nHe; i++) { if (res.conf[i] >= 1) anch.push(i); }

    var segs = [];
    var prevH = -1, prevE = -1;
    for (var s = 0; s <= anch.length; s++) {
        var curH = (s < anch.length) ? anch[s] : nHe;
        var curE = (s < anch.length) ? res.h2e[anch[s]] : nEn;
        var hFrom = prevH + 1, hTo = curH - 1;
        var eFrom = prevE + 1, eTo = curE - 1;
        if (hTo >= hFrom && eTo >= eFrom) {
            var len = Math.max(hTo - hFrom + 1, eTo - eFrom + 1);
            var sameLen = ((hTo - hFrom) === (eTo - eFrom));
            if (!onlyUnsure || !sameLen || len > 2) {
                segs.push({ hFrom: hFrom, hTo: hTo, eFrom: eFrom, eTo: eTo });
            }
        }
        prevH = curH; prevE = curE;
    }

    var err = "";
    for (i = 0; i < segs.length; i++) {
        if (prog && prog.cancelled()) { err = "Abgebrochen."; break; }
        if (AI_STAT.req >= S.ai.maxReq) { err = "Anfragelimit erreicht."; break; }
        var g = segs[i];
        if (prog) prog.step(i, segs.length, "L\u00fccke " + (g.hFrom + 1) + "\u2013" + (g.hTo + 1));
        var r = aiAlignRange(heOpen, enOpen, g.hFrom, g.hTo, g.eFrom, g.eTo, prog);
        for (var k in r.h2e) {
            if (!r.h2e.hasOwnProperty(k)) continue;
            var ki = parseInt(k, 10);
            res.h2e[ki] = r.h2e[k];
            res.conf[ki] = r.conf[k];
            res.ai++;
        }
        if (!r.ok) { err = r.error; break; }
    }
    if (S.ai.useCache) cacheSave();
    res.note += " | KI: " + res.ai + " Zuordnungen" + (err ? " (" + err + ")" : "");
    res.error = err;
    return res;
}

function pairAI(heMap, enMap, prog) {
    var nHe = heMap.starts.length, nEn = enMap.starts.length;
    var res = emptyPair(nHe, nEn);
    var heOpen = openingsOf(heMap, S.match.words);
    var enOpen = openingsOf(enMap, S.match.words);
    var r = aiAlignRange(heOpen, enOpen, 0, nHe - 1, 0, nEn - 1, prog);
    for (var k in r.h2e) {
        if (!r.h2e.hasOwnProperty(k)) continue;
        var ki = parseInt(k, 10);
        res.h2e[ki] = r.h2e[k]; res.conf[ki] = r.conf[k]; res.ai++;
    }
    if (S.ai.useCache) cacheSave();
    res.note = "KI: " + res.ai + " Zuordnungen" + (r.ok ? "" : " (" + r.error + ")");
    res.error = r.ok ? "" : r.error;
    return res;
}

function buildPairing(heMap, enMap, prog) {
    switch (S.match.mode) {
    case "index":  return pairIndex(heMap, enMap);
    case "ai":     return pairAI(heMap, enMap, prog);
    case "hybrid": return fillGapsWithAI(pairAnchor(heMap, enMap), heMap, enMap, prog, true);
    default:       return pairAnchor(heMap, enMap);
    }
}

/* ------------------------------------------------------------------ Analyse */

var CTX = null;

function analyze(prog) {
    var doc = app.activeDocument;
    var pages = resolvePages(doc);
    if (pages.length === 0) return { error: "Der gew\u00e4hlte Bereich enth\u00e4lt keine Seiten." };
    if (!S.ident.he || !S.ident.en) return { error: "Bitte zuerst HE- und EN-Spalte im Tab \u201eRahmen\u201c festlegen." };
    if ((S.match.mode === "ai" || S.match.mode === "hybrid") && apiKey() === "") {
        return { error: "F\u00fcr den KI-Abgleich fehlt der OpenAI-Schl\u00fcssel (Tab \u201eKI\u201c)." };
    }

    AI_STAT = { req: 0, cached: 0, fail: 0, ms: 0 };

    var cache = {}, pairs = {}, rows = [], warn = [];
    var threadOK = true, exactOK = true, aiErr = "";

    for (var p = 0; p < pages.length; p++) {
        var page = pages[p];
        var fr = framesForPage(page);
        var rec = { page: page, name: String(page.name), he: null, en: null,
                    heTop: -1, enTop: -1, expect: -1, drift: 0, conf: -1,
                    heKey: "", enKey: "", status: "", action: "" };

        if (!fr.he || !fr.en) {
            rec.status = (!fr.he && !fr.en) ? "kein HE+EN" : (!fr.he ? "kein HE-Rahmen" : "kein EN-Rahmen");
            rows.push(rec);
            continue;
        }
        rec.he = fr.he.frame; rec.en = fr.en.frame;
        if (!fr.he.threaded || !fr.en.threaded) threadOK = false;

        var hm = storyMap(fr.he.frame.parentStory, cache);
        var em = storyMap(fr.en.frame.parentStory, cache);
        if (!hm.exact || !em.exact) exactOK = false;

        var pk = String(fr.he.frame.parentStory.id) + "|" + String(fr.en.frame.parentStory.id);
        if (!pairs[pk]) {
            pairs[pk] = buildPairing(hm, em, prog);
            if (pairs[pk].error) aiErr = pairs[pk].error;
        }
        rec.pair = pairs[pk]; rec.hm = hm; rec.em = em;

        rec.heTop = frameTopPara(fr.he.frame, hm);
        rec.enTop = frameTopPara(fr.en.frame, em);

        if (rec.heTop < 0 || rec.enTop < 0) {
            rec.status = "kein Text im Rahmen";
            rows.push(rec);
            continue;
        }
        rec.heKey = snippet(openingText(hm.texts[rec.heTop], S.match.words), 40);
        rec.enKey = snippet(openingText(em.texts[rec.enTop], S.match.words), 40);
        rec.expect = pairLookup(rec.pair.h2e, rec.heTop);
        rec.conf   = (rec.pair.conf[rec.heTop] === undefined) ? -1 : rec.pair.conf[rec.heTop];
        rec.drift  = (rec.expect < 0) ? 0 : (rec.enTop - rec.expect);
        rec.status = (Math.abs(rec.drift) <= S.fix.tolPara)
                     ? "OK"
                     : ((rec.drift > 0 ? "\u0394 +" : "\u0394 ") + rec.drift);
        rows.push(rec);
    }

    if (!threadOK) warn.push("Mindestens ein Rahmen ist nicht verkettet \u2013 Korrektur dort wirkungslos.");
    if (!exactOK)  warn.push("Absatzkarte ungenau (Tabellen/Fu\u00dfnoten im Text) \u2013 Ergebnisse pr\u00fcfen.");
    if (aiErr)     warn.push("KI-Abgleich unvollst\u00e4ndig: " + aiErr);

    var noteTxt = "";
    for (var kk in pairs) { if (pairs.hasOwnProperty(kk)) { noteTxt = pairs[kk].note; break; } }

    CTX = { pages: pages, rows: rows, cache: cache, warn: warn, threadOK: threadOK, note: noteTxt };
    return CTX;
}

/* ------------------------------------------------------------------ Korrektur */

function currentDrift(rec) {
    rec.heTop = frameTopPara(rec.he, rec.hm);
    rec.enTop = frameTopPara(rec.en, rec.em);
    if (rec.heTop < 0 || rec.enTop < 0) return null;
    rec.expect = pairLookup(rec.pair.h2e, rec.heTop);
    if (rec.expect < 0) return null;
    rec.conf  = (rec.pair.conf[rec.heTop] === undefined) ? -1 : rec.pair.conf[rec.heTop];
    rec.drift = rec.enTop - rec.expect;
    return rec.drift;
}

function resizeFrame(tf, delta) {
    return withMM(function () {
        var gb = tf.geometricBounds;
        var b  = [gb[0], gb[1], gb[2], gb[3]];
        var nh = (b[2] - b[0]) + delta;
        if (nh < S.fix.minH || nh > S.fix.maxH) return false;
        if (S.fix.anchorEdge === "top") b[2] = b[0] + nh; else b[0] = b[2] - nh;
        try { tf.geometricBounds = b; } catch (e) { return false; }
        return true;
    });
}

function runFixCore() {
    var rows = CTX.rows, changed = 0, i;

    for (i = 1; i < rows.length; i++) {
        var rec = rows[i], prev = rows[i - 1];
        if (!rec.he || !rec.en || !prev.he || !prev.en) continue;

        var d = currentDrift(rec);
        if (d === null) continue;
        if (Math.abs(d) <= S.fix.tolPara) { rec.action = "\u2013"; continue; }

        var master = S.fix.master;
        var target = (master === "he") ? prev.en : prev.he;
        if (!target || !target.isValid) { rec.action = "kein Zielrahmen"; continue; }

        var startH = withMM(function () { var g = target.geometricBounds; return g[2] - g[0]; });
        var it = 0, stopped = "";

        while (it < S.fix.maxIter) {
            d = currentDrift(rec);
            if (d === null) { stopped = "Textfehler"; break; }
            if (Math.abs(d) <= S.fix.tolPara) break;
            var dir = (d > 0) ? -1 : 1;
            if (master === "en") dir = -dir;
            if (!resizeFrame(target, dir * S.fix.step)) { stopped = "H\u00f6henlimit"; break; }
            it++;
        }
        if (it >= S.fix.maxIter && stopped === "") stopped = "max. Schritte";

        var endH = withMM(function () { var g = target.geometricBounds; return g[2] - g[0]; });
        var diff = Math.round((endH - startH) * 10) / 10;
        if (diff !== 0) changed++;

        rec.action = (stopped !== "" ? stopped + " / " : "") +
                     (diff === 0 ? "keine \u00c4nderung"
                                 : (diff > 0 ? "+" : "") + mm(diff) + " mm @ S. " + prev.name);

        d = currentDrift(rec);
        rec.status = (d === null) ? "?" :
                     (Math.abs(d) <= S.fix.tolPara ? "OK" : ((d > 0 ? "\u0394 +" : "\u0394 ") + d));
    }
    return changed;
}

function runFix() {
    if (!CTX || !CTX.rows || CTX.rows.length === 0) { alert("Bitte zuerst pr\u00fcfen."); return 0; }
    var n = 0;
    app.doScript(function () { n = runFixCore(); },
                 ScriptLanguage.JAVASCRIPT, undefined,
                 UndoModes.ENTIRE_SCRIPT, SCRIPT_NAME);
    return n;
}

/* ------------------------------------------------------------------ Oberflaeche */

var win = null, liveTask = null, lastPageId = -1, scanList = [];

function buildUI() {
    var w = new Window("palette", SCRIPT_NAME + "  " + VERSION, undefined, { resizeable: false });
    w.orientation = "column";
    w.alignChildren = ["fill", "top"];
    w.spacing = 8; w.margins = 12;

    var head = w.add("group");
    head.alignment = "fill";
    var docTxt = head.add("statictext", undefined, "Dokument: \u2013");
    docTxt.preferredSize.width = 430;
    head.add("statictext", undefined, "").alignment = "fill";
    var modeTxt = head.add("statictext", undefined, "");
    modeTxt.preferredSize.width = 210;

    var tabs = w.add("tabbedpanel");
    tabs.alignChildren = "fill";
    tabs.preferredSize = [700, 372];

    /* ====================================================== Tab 1: Rahmen */
    var t1 = tabs.add("tab", undefined, "1 \u00b7 Rahmen");
    t1.orientation = "column"; t1.alignChildren = "fill"; t1.margins = 10;
    var t1i = t1.add("tabbedpanel"); t1i.alignChildren = "fill"; t1i.preferredSize = [670, 310];

    var s1 = t1i.add("tab", undefined, "Live-Scan");
    s1.orientation = "column"; s1.alignChildren = "fill"; s1.margins = 8; s1.spacing = 6;

    var g1 = s1.add("group");
    var bScan = g1.add("button", undefined, "Scannen"); bScan.preferredSize.width = 90;
    var cbLive = g1.add("checkbox", undefined, "Live \u2013 folgt der aktiven Seite");
    g1.add("statictext", undefined, "").alignment = "fill";
    var lblPage = g1.add("statictext", undefined, "Seite: \u2013"); lblPage.preferredSize.width = 120;

    var lb = s1.add("listbox", undefined, [], {
        numberOfColumns: 11, showHeaders: true,
        columnTitles: ["#", "Rolle", "X", "Y", "B", "H", "Ebene", "Objektstil", "Zchn", "Skript", "Textbeginn"],
        columnWidths: [24, 46, 40, 40, 40, 40, 74, 84, 46, 44, 168]
    });
    lb.preferredSize = [650, 176];

    var g2 = s1.add("group");
    var bHE  = g2.add("button", undefined, "\u2192 Hebr\u00e4isch"); bHE.preferredSize.width = 100;
    var bEN  = g2.add("button", undefined, "\u2192 Englisch");  bEN.preferredSize.width = 100;
    var bIGN = g2.add("button", undefined, "Ignorieren");        bIGN.preferredSize.width = 90;
    var bSEL = g2.add("button", undefined, "Im Dokument ausw\u00e4hlen"); bSEL.preferredSize.width = 156;

    var lblHE = s1.add("statictext", undefined, "HE-Regel: \u2013"); lblHE.alignment = "fill";
    var lblEN = s1.add("statictext", undefined, "EN-Regel: \u2013"); lblEN.alignment = "fill";

    var s2 = t1i.add("tab", undefined, "Erkennung");
    s2.orientation = "column"; s2.alignChildren = "left"; s2.margins = 10; s2.spacing = 8;
    var gm = s2.add("group");
    gm.add("statictext", undefined, "Regel ableiten aus:").preferredSize.width = 140;
    var ddMode = gm.add("dropdownlist", undefined, [
        "Position & Gr\u00f6\u00dfe (seitenrelativ)", "Objektstil", "Ebene",
        "Skript-Label", "Rahmenname", "Schriftsystem (Hebr\u00e4isch-Anteil)"]);
    ddMode.preferredSize.width = 270;
    var gt = s2.add("group");
    gt.add("statictext", undefined, "Toleranz (mm):").preferredSize.width = 140;
    var etTol = gt.add("edittext", undefined, "5"); etTol.preferredSize.width = 60;
    var cbMir = gt.add("checkbox", undefined, "Bundspiegelung bei Doppelseiten");
    var gh = s2.add("group");
    gh.add("statictext", undefined, "Hebr\u00e4isch ab Anteil:").preferredSize.width = 140;
    var etHeb = gh.add("edittext", undefined, "0.30"); etHeb.preferredSize.width = 60;
    gh.add("statictext", undefined, "(0\u20131, nur f\u00fcr Modus \u201eSchriftsystem\u201c)");
    s2.add("statictext", undefined,
        "Die Regel wird auf jeder Seite des Bereichs neu ausgewertet. \u201ePosition\u201c ist am robustesten\n" +
        "bei sauberem Satzspiegel, \u201eObjektstil\u201c oder \u201eEbene\u201c bei gemischten Layouts.\n" +
        "Die Rahmenh\u00f6he geht bewusst nicht in den Positionsvergleich ein, damit die Regel nach\n" +
        "einer Korrektur weiterhin greift.", { multiline: true }).preferredSize = [620, 62];

    var s3 = t1i.add("tab", undefined, "Filter");
    s3.orientation = "column"; s3.alignChildren = "left"; s3.margins = 10; s3.spacing = 8;
    function nrow(parent, label, val, unit) {
        var g = parent.add("group");
        g.add("statictext", undefined, label).preferredSize.width = 210;
        var e = g.add("edittext", undefined, String(val)); e.preferredSize.width = 70;
        if (unit) g.add("statictext", undefined, unit);
        return e;
    }
    var etMinW = nrow(s3, "Mindestbreite", 20, "mm");
    var etMinH = nrow(s3, "Mindesth\u00f6he", 20, "mm");
    var etMinC = nrow(s3, "Mindestanzahl Zeichen", 20, "");
    var cbNum  = s3.add("checkbox", undefined, "Rahmen mit reinem Ziffern-/R\u00f6mischtext ignorieren (Pagina)");
    var cbLock = s3.add("checkbox", undefined, "gesperrte Rahmen ignorieren");
    s3.add("statictext", undefined,
        "Rahmen von Musterseiten erscheinen ohnehin nicht in der Liste, solange sie nicht\n" +
        "lokal \u00fcberschrieben wurden.", { multiline: true }).preferredSize = [600, 32];

    /* ====================================================== Tab 2: Bereich */
    var t2 = tabs.add("tab", undefined, "2 \u00b7 Bereich");
    t2.orientation = "column"; t2.alignChildren = "left"; t2.margins = 14; t2.spacing = 8;
    var rDoc = t2.add("radiobutton", undefined, "Ganzes Dokument");
    var rCur = t2.add("radiobutton", undefined, "Aktive Seite");
    var rSpr = t2.add("radiobutton", undefined, "Aktueller Druckbogen");
    var rSel = t2.add("radiobutton", undefined, "Seiten der aktuellen Objektauswahl");
    var rRng = t2.add("radiobutton", undefined, "Seitenbereich:");
    var gr = t2.add("group");
    gr.add("statictext", undefined, "").preferredSize.width = 18;
    var etRange = gr.add("edittext", undefined, ""); etRange.preferredSize.width = 300;
    var bFromPage = gr.add("button", undefined, "Aus aktiver Seite");
    var bFromSel  = gr.add("button", undefined, "Aus Auswahl");
    t2.add("statictext", undefined,
        "Schreibweise: 3-8, 12, 20-  \u2013  es gelten die Seitennamen aus den Abschnitten,\n" +
        "ersatzweise die absolute Seitenzahl.\n\n" +
        "Hinweis: Die Mehrfachauswahl im Seiten-Bedienfeld l\u00e4sst sich per Script nicht auslesen.\n" +
        "Nutze daf\u00fcr den Seitenbereich oder markiere Objekte auf den betreffenden Seiten.",
        { multiline: true }).preferredSize = [640, 76];

    /* ====================================================== Tab 3: Abgleich */
    var t3 = tabs.add("tab", undefined, "3 \u00b7 Abgleich");
    t3.orientation = "column"; t3.alignChildren = "left"; t3.margins = 14; t3.spacing = 7;

    var g31 = t3.add("group");
    g31.add("statictext", undefined, "Verfahren:").preferredSize.width = 175;
    var ddMatch = g31.add("dropdownlist", undefined, [
        "Anker aus den ersten W\u00f6rtern (ohne KI)",
        "Feste Index-Kopplung",
        "Anker + KI f\u00fcr L\u00fccken (empfohlen)",
        "Reiner KI-Abgleich"]);
    ddMatch.preferredSize.width = 300;

    var g32 = t3.add("group");
    g32.add("statictext", undefined, "Vergleichsl\u00e4nge:").preferredSize.width = 175;
    var ddWords = g32.add("dropdownlist", undefined, ["3 W\u00f6rter", "4 W\u00f6rter", "5 W\u00f6rter", "6 W\u00f6rter", "7 W\u00f6rter"]);
    ddWords.preferredSize.width = 110;
    g32.add("statictext", undefined, "je Absatzanfang");

    var g33 = t3.add("group");
    g33.add("statictext", undefined, "Anker per regul\u00e4rem Ausdruck:").preferredSize.width = 175;
    var cbRe = g33.add("checkbox", undefined, "");
    var etRe = g33.add("edittext", undefined, "^\\s*([0-9]{1,4})"); etRe.preferredSize.width = 250;

    var g34 = t3.add("group");
    g34.add("statictext", undefined, "Index-Versatz (EN \u2212 HE):").preferredSize.width = 175;
    var etOff = g34.add("edittext", undefined, "0"); etOff.preferredSize.width = 55;
    g34.add("statictext", undefined, "Suchfenster Anker:").preferredSize.width = 115;
    var etWin = g34.add("edittext", undefined, "25"); etWin.preferredSize.width = 55;

    t3.add("panel").preferredSize = [640, 2];

    t3.add("statictext", undefined,
        "Anker sind Zeichenketten, die beide Sprachen teilen \u2013 typischerweise Vers-, Kapitel- oder\n" +
        "Absatznummern am Absatzanfang. Ohne solche Nummern greift das KI-Verfahren: es\n" +
        "vergleicht die ersten 3\u20137 W\u00f6rter inhaltlich \u00fcber die Sprachgrenze hinweg.\n" +
        "Nikud, Teamim und Richtungssteuerzeichen werden vor jedem Vergleich entfernt.",
        { multiline: true }).preferredSize = [645, 62];

    var g35 = t3.add("group"); g35.alignment = "fill";
    var bCheck = g35.add("button", undefined, "Pr\u00fcfen"); bCheck.preferredSize.width = 130;
    var lblCheck = g35.add("statictext", undefined, ""); lblCheck.alignment = "fill";

    /* ====================================================== Tab 4: KI */
    var t4 = tabs.add("tab", undefined, "4 \u00b7 KI");
    t4.orientation = "column"; t4.alignChildren = "fill"; t4.margins = 10;
    var t4i = t4.add("tabbedpanel"); t4i.alignChildren = "fill"; t4i.preferredSize = [670, 310];

    /* -- Zugang */
    var k1 = t4i.add("tab", undefined, "Zugang");
    k1.orientation = "column"; k1.alignChildren = "left"; k1.margins = 10; k1.spacing = 7;

    function krow(parent, label, val, wdt) {
        var g = parent.add("group");
        g.add("statictext", undefined, label).preferredSize.width = 150;
        var e = g.add("edittext", undefined, String(val));
        e.preferredSize.width = wdt || 300;
        return { g: g, e: e };
    }
    var etEnd   = krow(k1, "Endpunkt:", "https://api.openai.com/v1/chat/completions", 400).e;
    var etModel = krow(k1, "Modell:", "gpt-4o-mini", 200).e;

    var gk = k1.add("group");
    gk.add("statictext", undefined, "API-Schl\u00fcssel:").preferredSize.width = 150;
    var etKey = gk.add("edittext", undefined, "", { noecho: true }); etKey.preferredSize.width = 300;
    var bKeySet = gk.add("button", undefined, "\u00dcbernehmen"); bKeySet.preferredSize.width = 100;

    var gk2 = k1.add("group");
    gk2.add("statictext", undefined, "").preferredSize.width = 150;
    var lblKey = gk2.add("statictext", undefined, "kein Schl\u00fcssel gesetzt"); lblKey.preferredSize.width = 400;

    var gk3 = k1.add("group");
    gk3.add("statictext", undefined, "").preferredSize.width = 150;
    var cbEnv = gk3.add("checkbox", undefined, "Umgebungsvariable OPENAI_API_KEY bevorzugen");
    var gk4 = k1.add("group");
    gk4.add("statictext", undefined, "").preferredSize.width = 150;
    var cbStore = gk4.add("checkbox", undefined, "Schl\u00fcssel in Einstellungsdatei ablegen (Klartext!)");

    var etOrg   = krow(k1, "Organisation (opt.):", "", 250).e;
    var gpx = k1.add("group");
    gpx.add("statictext", undefined, "Proxy (nur Windows):").preferredSize.width = 150;
    var etProxy = gpx.add("edittext", undefined, ""); etProxy.preferredSize.width = 200;
    gpx.add("statictext", undefined, "Timeout (s):").preferredSize.width = 80;
    var etTimeout = gpx.add("edittext", undefined, "120"); etTimeout.preferredSize.width = 50;

    var gk5 = k1.add("group");
    gk5.add("statictext", undefined, "").preferredSize.width = 150;
    var cbTemp = gk5.add("checkbox", undefined, "temperature = 0 senden (bei manchen Modellen abschalten)");

    var gk6 = k1.add("group"); gk6.alignment = "fill";
    gk6.add("statictext", undefined, "").preferredSize.width = 150;
    var bTest = gk6.add("button", undefined, "Verbindung testen"); bTest.preferredSize.width = 150;
    var lblTest = gk6.add("statictext", undefined, ""); lblTest.alignment = "fill";

    k1.add("statictext", undefined,
        "ExtendScript kann kein HTTPS. Die Anfrage l\u00e4uft \u00fcber die Systembr\u00fccke:\n" +
        (IS_WIN ? "Windows \u2013 VBScript mit MSXML2.ServerXMLHTTP." : "macOS \u2013 AppleScript mit /usr/bin/curl.") +
        " Tempor\u00e4re Dateien werden sofort gel\u00f6scht.",
        { multiline: true }).preferredSize = [640, 46];

    /* -- Abgleich-Parameter */
    var k2 = t4i.add("tab", undefined, "Parameter");
    k2.orientation = "column"; k2.alignChildren = "left"; k2.margins = 10; k2.spacing = 8;

    var gb1 = k2.add("group");
    gb1.add("statictext", undefined, "Abs\u00e4tze je Anfrage:").preferredSize.width = 200;
    var etBlock = gb1.add("edittext", undefined, "30"); etBlock.preferredSize.width = 60;
    gb1.add("statictext", undefined, "\u00dcberlappung:").preferredSize.width = 90;
    var etOv = gb1.add("edittext", undefined, "4"); etOv.preferredSize.width = 50;

    var gb2 = k2.add("group");
    gb2.add("statictext", undefined, "Mindestkonfidenz (0\u20131):").preferredSize.width = 200;
    var etConf = gb2.add("edittext", undefined, "0.6"); etConf.preferredSize.width = 60;
    gb2.add("statictext", undefined, "max. Anfragen:").preferredSize.width = 90;
    var etMaxReq = gb2.add("edittext", undefined, "200"); etMaxReq.preferredSize.width = 50;

    var gb3 = k2.add("group");
    gb3.add("statictext", undefined, "").preferredSize.width = 0;
    var cbCache = gb3.add("checkbox", undefined, "Ergebnisse zwischenspeichern");
    var bCacheClear = gb3.add("button", undefined, "Cache leeren"); bCacheClear.preferredSize.width = 110;
    var lblCache = gb3.add("statictext", undefined, ""); lblCache.preferredSize.width = 160;

    k2.add("panel").preferredSize = [640, 2];

    var gb4 = k2.add("group"); gb4.alignment = "fill";
    var bAiRun = gb4.add("button", undefined, "KI-Zuordnung berechnen"); bAiRun.preferredSize.width = 190;
    var lblAi = gb4.add("statictext", undefined, ""); lblAi.alignment = "fill";
    var pbar = k2.add("progressbar", undefined, 0, 100); pbar.preferredSize = [640, 10];
    var lblProg = k2.add("statictext", undefined, ""); lblProg.preferredSize = [640, 18];

    k2.add("statictext", undefined,
        "Der Abgleich l\u00e4uft blockweise: je Anfrage werden die Absatzanf\u00e4nge beider Sprachen\n" +
        "gemeinsam bewertet, die Zuordnung mu\u00df streng monoton steigen. Ergebnisse unterhalb\n" +
        "der Mindestkonfidenz werden verworfen und 1:1 gekoppelt.\n" +
        "Laufende Berechnung mit der Esc-Taste abbrechen.",
        { multiline: true }).preferredSize = [645, 62];

    /* -- Protokoll */
    var k3 = t4i.add("tab", undefined, "Protokoll");
    k3.orientation = "column"; k3.alignChildren = "fill"; k3.margins = 10; k3.spacing = 6;
    var logBox = k3.add("edittext", undefined, "", { multiline: true, scrolling: true, readonly: true });
    logBox.preferredSize = [650, 232];
    var gl = k3.add("group");
    var bLogClear = gl.add("button", undefined, "Leeren");
    var bLogSave  = gl.add("button", undefined, "Sichern \u2026");
    gl.add("statictext", undefined, "").alignment = "fill";
    var lblStat = gl.add("statictext", undefined, ""); lblStat.preferredSize.width = 330;

    /* ====================================================== Tab 5: Korrektur */
    var t5 = tabs.add("tab", undefined, "5 \u00b7 Korrektur");
    t5.orientation = "column"; t5.alignChildren = "left"; t5.margins = 14; t5.spacing = 8;

    var g41 = t5.add("group");
    g41.add("statictext", undefined, "Leitspalte (bleibt unver\u00e4ndert):").preferredSize.width = 215;
    var ddMaster = g41.add("dropdownlist", undefined,
        ["Hebr\u00e4isch f\u00fchrt \u2013 Englisch anpassen", "Englisch f\u00fchrt \u2013 Hebr\u00e4isch anpassen"]);
    ddMaster.preferredSize.width = 290;

    var g42 = t5.add("group");
    g42.add("statictext", undefined, "H\u00f6he min / max (mm):").preferredSize.width = 215;
    var etMinHF = g42.add("edittext", undefined, "40"); etMinHF.preferredSize.width = 60;
    var etMaxHF = g42.add("edittext", undefined, "260"); etMaxHF.preferredSize.width = 60;

    var g43 = t5.add("group");
    g43.add("statictext", undefined, "Schrittweite (mm) / max. Schritte:").preferredSize.width = 215;
    var etStep = g43.add("edittext", undefined, "1"); etStep.preferredSize.width = 60;
    var etIter = g43.add("edittext", undefined, "60"); etIter.preferredSize.width = 60;

    var g44 = t5.add("group");
    g44.add("statictext", undefined, "Fixe Kante:").preferredSize.width = 215;
    var ddEdge = g44.add("dropdownlist", undefined,
        ["Oberkante (Unterkante wandert)", "Unterkante (Oberkante wandert)"]);
    ddEdge.preferredSize.width = 270;

    var g45 = t5.add("group");
    g45.add("statictext", undefined, "Erlaubte Abweichung (Abs\u00e4tze):").preferredSize.width = 215;
    var etTolP = g45.add("edittext", undefined, "0"); etTolP.preferredSize.width = 60;

    t5.add("statictext", undefined,
        "Korrigiert wird immer der Rahmen der VORHERIGEN Seite \u2013 nur er entscheidet, welcher\n" +
        "Absatz oben auf der Folgeseite steht. Die Seiten werden der Reihe nach abgearbeitet\n" +
        "und nach jedem Schritt neu gemessen.\n" +
        "Voraussetzung: verkettete Textrahmen. Alles l\u00e4uft in einem Undo-Schritt.",
        { multiline: true }).preferredSize = [645, 62];

    var g46 = t5.add("group"); g46.alignment = "fill";
    var bFix = g46.add("button", undefined, "Korrektur ausf\u00fchren"); bFix.preferredSize.width = 180;
    var lblFix = g46.add("statictext", undefined, ""); lblFix.alignment = "fill";

    /* ====================================================== Tab 6: Bericht */
    var t6 = tabs.add("tab", undefined, "6 \u00b7 Bericht");
    t6.orientation = "column"; t6.alignChildren = "fill"; t6.margins = 10; t6.spacing = 6;
    var rep = t6.add("listbox", undefined, [], {
        numberOfColumns: 10, showHeaders: true,
        columnTitles: ["Seite", "HE-Abs.", "HE-Beginn", "EN-Abs.", "EN-Beginn", "Soll", "\u0394", "Konf.", "Status", "Aktion"],
        columnWidths: [40, 50, 128, 50, 128, 40, 32, 42, 62, 68]
    });
    rep.preferredSize = [670, 258];
    var g51 = t6.add("group");
    var bGoto = g51.add("button", undefined, "Zur Seite springen");
    var bCSV  = g51.add("button", undefined, "CSV exportieren");
    g51.add("statictext", undefined, "").alignment = "fill";
    var lblSum = g51.add("statictext", undefined, ""); lblSum.preferredSize.width = 320;

    /* ====================================================== Fusszeile */
    var foot = w.add("group"); foot.alignment = "fill";
    var bSaveS = foot.add("button", undefined, "Einstellungen sichern");
    var bLoadS = foot.add("button", undefined, "Laden");
    foot.add("statictext", undefined, "").alignment = "fill";
    var bClose = foot.add("button", undefined, "Schlie\u00dfen");

    /* ============================================ UI <-> Einstellungen */

    var MODES = ["pos", "style", "layer", "label", "name", "script"];
    var MATCH = ["anchor", "index", "hybrid", "ai"];
    var EDGES = ["top", "bottom"];

    function refreshMode() {
        var m = S.match.mode;
        var nm = (m === "anchor") ? "Anker" : (m === "index") ? "Index" :
                 (m === "hybrid") ? "Anker + KI" : "KI";
        modeTxt.text = "Verfahren: " + nm + "  \u00b7  " + S.match.words + " W\u00f6rter";
        var needsAI = (m === "hybrid" || m === "ai");
        lblKey.text = "Schl\u00fcssel: " + keyStatus() + (needsAI ? "" : "  (f\u00fcr dieses Verfahren nicht n\u00f6tig)");
        lblCache.text = cacheCount() + " Eintr\u00e4ge im Cache";
    }

    function uiFromS() {
        ddMode.selection = Math.max(0, inArr(MODES, S.ident.mode));
        etTol.text = String(S.ident.tolMm);
        cbMir.value = S.ident.mirror;
        etHeb.text = String(S.ident.hebThreshold);

        etMinW.text = String(S.filter.minW);
        etMinH.text = String(S.filter.minH);
        etMinC.text = String(S.filter.minChars);
        cbNum.value = S.filter.skipNumeric;
        cbLock.value = S.filter.skipLocked;

        rDoc.value = (S.range.mode === "doc");
        rCur.value = (S.range.mode === "current");
        rSpr.value = (S.range.mode === "spread");
        rSel.value = (S.range.mode === "selection");
        rRng.value = (S.range.mode === "range");
        etRange.text = String(S.range.text);

        ddMatch.selection = Math.max(0, inArr(MATCH, S.match.mode));
        ddWords.selection = Math.max(0, Math.min(4, S.match.words - 3));
        cbRe.value = S.match.useRegex;
        etRe.text = String(S.match.regex);
        etOff.text = String(S.match.offset);
        etWin.text = String(S.match.window);

        etEnd.text = String(S.ai.endpoint);
        etModel.text = String(S.ai.model);
        etKey.text = S.ai.apiKey ? S.ai.apiKey : "";
        cbEnv.value = S.ai.useEnv;
        cbStore.value = S.ai.storeKey;
        etOrg.text = String(S.ai.org);
        etProxy.text = String(S.ai.proxy);
        etTimeout.text = String(S.ai.timeout);
        cbTemp.value = S.ai.sendTemp;
        etBlock.text = String(S.ai.block);
        etOv.text = String(S.ai.overlap);
        etConf.text = String(S.ai.minConf);
        etMaxReq.text = String(S.ai.maxReq);
        cbCache.value = S.ai.useCache;

        ddMaster.selection = (S.fix.master === "en") ? 1 : 0;
        etMinHF.text = String(S.fix.minH);
        etMaxHF.text = String(S.fix.maxH);
        etStep.text = String(S.fix.step);
        etIter.text = String(S.fix.maxIter);
        ddEdge.selection = Math.max(0, inArr(EDGES, S.fix.anchorEdge));
        etTolP.text = String(S.fix.tolPara);

        lblHE.text = "HE-Regel: " + refLabel(S.ident.he);
        lblEN.text = "EN-Regel: " + refLabel(S.ident.en);
        refreshMode();
    }

    function sFromUI() {
        S.ident.mode = MODES[ddMode.selection ? ddMode.selection.index : 0];
        S.ident.tolMm = num(etTol.text, 5);
        S.ident.mirror = cbMir.value;
        S.ident.hebThreshold = num(etHeb.text, 0.3);

        S.filter.minW = num(etMinW.text, 20);
        S.filter.minH = num(etMinH.text, 20);
        S.filter.minChars = num(etMinC.text, 20);
        S.filter.skipNumeric = cbNum.value;
        S.filter.skipLocked = cbLock.value;

        S.range.mode = rCur.value ? "current" : rSpr.value ? "spread" :
                       rSel.value ? "selection" : rRng.value ? "range" : "doc";
        S.range.text = etRange.text;

        S.match.mode = MATCH[ddMatch.selection ? ddMatch.selection.index : 0];
        S.match.words = 3 + (ddWords.selection ? ddWords.selection.index : 2);
        S.match.useRegex = cbRe.value;
        S.match.regex = etRe.text;
        S.match.offset = Math.round(num(etOff.text, 0));
        S.match.window = Math.max(1, Math.round(num(etWin.text, 25)));

        S.ai.endpoint = trim(etEnd.text);
        S.ai.model = trim(etModel.text);
        S.ai.useEnv = cbEnv.value;
        S.ai.storeKey = cbStore.value;
        S.ai.org = trim(etOrg.text);
        S.ai.proxy = trim(etProxy.text);
        S.ai.timeout = Math.max(5, Math.round(num(etTimeout.text, 120)));
        S.ai.sendTemp = cbTemp.value;
        S.ai.block = Math.max(5, Math.round(num(etBlock.text, 30)));
        S.ai.overlap = Math.max(0, Math.round(num(etOv.text, 4)));
        S.ai.minConf = Math.max(0, Math.min(1, num(etConf.text, 0.6)));
        S.ai.maxReq = Math.max(1, Math.round(num(etMaxReq.text, 200)));
        S.ai.useCache = cbCache.value;

        S.fix.master = (ddMaster.selection && ddMaster.selection.index === 1) ? "en" : "he";
        S.fix.minH = num(etMinHF.text, 40);
        S.fix.maxH = num(etMaxHF.text, 260);
        S.fix.step = Math.max(0.1, num(etStep.text, 1));
        S.fix.maxIter = Math.max(1, Math.round(num(etIter.text, 60)));
        S.fix.anchorEdge = EDGES[ddEdge.selection ? ddEdge.selection.index : 0];
        S.fix.tolPara = Math.max(0, Math.round(num(etTolP.text, 0)));
    }

    /* ============================================ Protokoll-Anbindung */

    UI_LOG_SYNC = function () {
        try {
            logBox.text = LOG.join("\n");
            lblStat.text = "Anfragen " + AI_STAT.req + " \u00b7 Cache " + AI_STAT.cached +
                           " \u00b7 Fehler " + AI_STAT.fail +
                           (AI_STAT.req ? " \u00b7 \u00d8 " + Math.round(AI_STAT.ms / AI_STAT.req) + " ms" : "");
            w.update();
        } catch (e) {}
    };

    function makeProg() {
        return {
            step: function (i, n, label) {
                try {
                    pbar.value = Math.max(0, Math.min(100, Math.round(i / Math.max(1, n) * 100)));
                    lblProg.text = label + "   \u2013 " + AI_STAT.req + " Anfragen, " +
                                   AI_STAT.cached + " aus Cache   (Esc bricht ab)";
                    w.update();
                } catch (e) {}
            },
            cancelled: function () {
                try { return ScriptUI.environment.keyboardState.keyName === "Escape"; }
                catch (e) { return false; }
            }
        };
    }

    /* ============================================ Scan */

    function activePage() {
        if (app.documents.length === 0) return null;
        if (!(app.activeWindow instanceof LayoutWindow)) return null;
        return app.activeWindow.activePage;
    }

    function doScan() {
        lb.removeAll(); scanList = [];
        var pg = activePage();
        if (!pg) { lblPage.text = "Seite: \u2013"; return; }
        lblPage.text = "Seite: " + pg.name;
        docTxt.text = "Dokument: " + app.activeDocument.name;

        sFromUI();
        scanList = scanPage(pg);

        for (var i = 0; i < scanList.length; i++) {
            var f = scanList[i], role = "";
            if (f.excluded) role = "(" + f.reason + ")";
            else if (S.ident.he && matchRole(f, S.ident.he)) role = "HEBR\u00c4ISCH";
            else if (S.ident.en && matchRole(f, S.ident.en)) role = "ENGLISCH";

            var it = lb.add("item", String(f.no));
            it.subItems[0].text = role;
            it.subItems[1].text = mm(f.x);
            it.subItems[2].text = mm(f.y);
            it.subItems[3].text = mm(f.w);
            it.subItems[4].text = mm(f.h);
            it.subItems[5].text = f.layer;
            it.subItems[6].text = f.objStyle;
            it.subItems[7].text = String(f.chars) + (f.overflows ? "\u25b6" : "");
            it.subItems[8].text = f.script;
            it.subItems[9].text = snippet(f.text, 60);
        }
    }

    function assignRole(which) {
        if (!lb.selection) { alert("Bitte einen Rahmen in der Liste ausw\u00e4hlen."); return; }
        sFromUI();
        var f = scanList[lb.selection.index];
        if (which === "ign") {
            S.filter.minChars = Math.max(S.filter.minChars, f.chars + 1);
            etMinC.text = String(S.filter.minChars);
        } else if (which === "he") { S.ident.he = refFromInfo(f); }
        else { S.ident.en = refFromInfo(f); }
        lblHE.text = "HE-Regel: " + refLabel(S.ident.he);
        lblEN.text = "EN-Regel: " + refLabel(S.ident.en);
        doScan();
    }

    /* ============================================ Live-Task */

    function stopLive() {
        try { if (liveTask && liveTask.isValid) liveTask.remove(); } catch (e) {}
        liveTask = null;
    }
    function onIdle() {
        try {
            if (!win || !win.visible) { stopLive(); return; }
            var pg = activePage();
            if (!pg) return;
            if (pg.id !== lastPageId) { lastPageId = pg.id; doScan(); }
        } catch (e) {}
    }
    function startLive() {
        stopLive();
        try {
            liveTask = app.idleTasks.add({ name: "HEEN_LiveScan", sleep: 600 });
            liveTask.addEventListener(IdleEvent.ON_IDLE, onIdle, false);
        } catch (e) { cbLive.value = false; }
    }

    /* ============================================ Bericht */

    function fillReport(ctx) {
        rep.removeAll();
        var ok = 0, bad = 0, err = 0;
        for (var i = 0; i < ctx.rows.length; i++) {
            var r = ctx.rows[i];
            var it = rep.add("item", r.name);
            it.subItems[0].text = (r.heTop >= 0) ? String(r.heTop + 1) : "\u2013";
            it.subItems[1].text = r.heKey;
            it.subItems[2].text = (r.enTop >= 0) ? String(r.enTop + 1) : "\u2013";
            it.subItems[3].text = r.enKey;
            it.subItems[4].text = (r.expect >= 0) ? String(r.expect + 1) : "\u2013";
            it.subItems[5].text = (r.heTop >= 0 && r.enTop >= 0) ? String(r.drift) : "";
            it.subItems[6].text = (r.conf < 0) ? "" : (r.conf >= 1 ? "Anker" : String(Math.round(r.conf * 100) + "%"));
            it.subItems[7].text = r.status;
            it.subItems[8].text = r.action || "";
            if (r.status === "OK") ok++;
            else if (r.status.indexOf("\u0394") === 0) bad++;
            else err++;
        }
        lblSum.text = ok + " synchron, " + bad + " Versatz, " + err + " ohne Auswertung";
        return { ok: ok, bad: bad, err: err };
    }

    /* ============================================ Handler */

    bScan.onClick = function () {
        if (app.documents.length === 0) { alert("Kein Dokument ge\u00f6ffnet."); return; }
        doScan();
    };
    cbLive.onClick = function () { if (cbLive.value) { lastPageId = -1; startLive(); } else stopLive(); };
    bHE.onClick  = function () { assignRole("he"); };
    bEN.onClick  = function () { assignRole("en"); };
    bIGN.onClick = function () { assignRole("ign"); };
    bSEL.onClick = function () {
        if (!lb.selection) return;
        try {
            var f = scanList[lb.selection.index];
            app.activeWindow.activePage = f.page;
            app.select(f.frame);
        } catch (e) {}
    };
    ddMode.onChange = function () { sFromUI(); doScan(); };
    ddMatch.onChange = function () { sFromUI(); refreshMode(); };
    ddWords.onChange = function () { sFromUI(); refreshMode(); };

    bFromPage.onClick = function () {
        var pg = activePage();
        if (pg) { etRange.text = String(pg.name); rRng.value = true; }
    };
    bFromSel.onClick = function () {
        var seen = [], out = [];
        for (var i = 0; i < app.selection.length; i++) {
            try {
                var pg = app.selection[i].parentPage;
                if (pg && pg.isValid && inArr(seen, pg.id) < 0) { seen.push(pg.id); out.push(String(pg.name)); }
            } catch (e) {}
        }
        if (out.length) { etRange.text = out.join(", "); rRng.value = true; }
        else alert("Es sind keine Objekte auf Seiten ausgew\u00e4hlt.");
    };

    bKeySet.onClick = function () {
        sFromUI();
        var k = trim(etKey.text);
        $.global.__HEEN_KEY = k;
        S.ai.apiKey = S.ai.storeKey ? k : "";
        refreshMode();
        logAdd("Schl\u00fcssel " + (k === "" ? "gel\u00f6scht" : "\u00fcbernommen (" + keyStatus() + ")"));
    };
    cbEnv.onClick = function () { sFromUI(); refreshMode(); };

    bTest.onClick = function () {
        sFromUI();
        lblTest.text = "sende Testanfrage \u2026"; w.update();
        var r = aiTest();
        lblTest.text = r.ok ? ("OK \u2013 " + S.ai.model + ", " + r.ms + " ms")
                            : ("Fehler: " + snippet(r.error, 90));
        UI_LOG_SYNC();
    };

    bCacheClear.onClick = function () { cacheClear(); refreshMode(); logAdd("Cache geleert."); };

    bAiRun.onClick = function () {
        sFromUI();
        if (S.match.mode !== "ai" && S.match.mode !== "hybrid") {
            alert("Das gew\u00e4hlte Verfahren nutzt keine KI. Stelle in Tab 3 auf\n" +
                  "\u201eAnker + KI f\u00fcr L\u00fccken\u201c oder \u201eReiner KI-Abgleich\u201c um.");
            return;
        }
        if (apiKey() === "") { alert("Kein API-Schl\u00fcssel hinterlegt."); return; }
        pbar.value = 0;
        var ctx = analyze(makeProg());
        pbar.value = 100;
        if (ctx.error) { lblAi.text = ""; alert(ctx.error); return; }
        var st = fillReport(ctx);
        lblAi.text = "fertig \u2013 " + (ctx.note || "");
        lblProg.text = AI_STAT.req + " Anfragen, " + AI_STAT.cached + " aus Cache, " + AI_STAT.fail + " Fehler";
        lblCheck.text = "Gepr\u00fcft: " + ctx.rows.length + " Seiten \u2013 " + st.ok + " OK, " + st.bad + " mit Versatz.";
        refreshMode();
        if (ctx.warn.length) alert("Hinweis:\n\n\u2022 " + ctx.warn.join("\n\u2022 "));
    };

    bLogClear.onClick = function () { LOG = []; UI_LOG_SYNC(); };
    bLogSave.onClick = function () {
        var f = File.saveDialog("Protokoll sichern", "Text:*.txt");
        if (f) writeUTF8(f, LOG.join("\n"));
    };

    bCheck.onClick = function () {
        if (app.documents.length === 0) { alert("Kein Dokument ge\u00f6ffnet."); return; }
        sFromUI();
        pbar.value = 0;
        var ctx = analyze(makeProg());
        if (ctx.error) { lblCheck.text = ""; alert(ctx.error); return; }
        var st = fillReport(ctx);
        lblCheck.text = "Gepr\u00fcft: " + ctx.rows.length + " Seiten \u2013 " +
                        st.ok + " OK, " + st.bad + " mit Versatz." +
                        (ctx.note ? "  [" + ctx.note + "]" : "");
        tabs.selection = 5;
        refreshMode();
        if (ctx.warn.length) alert("Hinweis:\n\n\u2022 " + ctx.warn.join("\n\u2022 "));
    };

    bFix.onClick = function () {
        sFromUI();
        if (!CTX) { alert("Bitte zuerst pr\u00fcfen (Tab 3)."); return; }
        if (!CTX.threadOK &&
            !confirm("Nicht alle Rahmen sind verkettet. Eine H\u00f6henkorrektur bleibt dort ohne\n" +
                     "Wirkung auf den Seitenumbruch. Trotzdem fortfahren?")) return;
        var n = runFix();
        fillReport(CTX);
        lblFix.text = n + " Rahmen angepasst. R\u00fcckg\u00e4ngig mit einem Undo-Schritt.";
        tabs.selection = 5;
    };

    bGoto.onClick = function () {
        if (!rep.selection || !CTX) return;
        try {
            var r = CTX.rows[rep.selection.index];
            app.activeWindow.activePage = r.page;
            if (r.he) app.select(r.he);
        } catch (e) {}
    };

    bCSV.onClick = function () {
        if (!CTX) return;
        var f = File.saveDialog("Bericht speichern", "CSV:*.csv");
        if (!f) return;
        try {
            f.encoding = "UTF-8";
            f.open("w");
            f.write("\uFEFF");
            f.writeln("Seite;HE-Absatz;HE-Beginn;EN-Absatz;EN-Beginn;Soll;Delta;Konfidenz;Status;Aktion");
            for (var i = 0; i < CTX.rows.length; i++) {
                var r = CTX.rows[i];
                f.writeln([r.name,
                           (r.heTop >= 0 ? r.heTop + 1 : ""),
                           '"' + String(r.heKey).replace(/"/g, "'") + '"',
                           (r.enTop >= 0 ? r.enTop + 1 : ""),
                           '"' + String(r.enKey).replace(/"/g, "'") + '"',
                           (r.expect >= 0 ? r.expect + 1 : ""),
                           r.drift,
                           (r.conf < 0 ? "" : (r.conf >= 1 ? "Anker" : Math.round(r.conf * 100) + "%")),
                           r.status, (r.action || "")].join(";"));
            }
            f.close();
        } catch (e) { alert("Export fehlgeschlagen: " + e); }
    };

    bSaveS.onClick = function () { sFromUI(); alert(saveSettings() ? "Einstellungen gesichert." : "Speichern fehlgeschlagen."); };
    bLoadS.onClick = function () { if (loadSettings()) { uiFromS(); doScan(); } else alert("Keine gespeicherten Einstellungen gefunden."); };
    bClose.onClick = function () { stopLive(); win.close(); };
    w.onClose = function () { stopLive(); UI_LOG_SYNC = null; };

    loadSettings();
    uiFromS();
    if (S.ai.apiKey) $.global.__HEEN_KEY = S.ai.apiKey;
    logAdd(SCRIPT_NAME + " " + VERSION + " bereit \u2013 Bruecke: " + (IS_WIN ? "VBScript/MSXML" : "AppleScript/curl"));
    if (app.documents.length > 0) { docTxt.text = "Dokument: " + app.activeDocument.name; doScan(); }

    return w;
}

/* ------------------------------------------------------------------ Start */

if (typeof $.global.__HEEN_WIN !== "undefined" && $.global.__HEEN_WIN !== null) {
    try { $.global.__HEEN_WIN.close(); } catch (e) {}
}
win = buildUI();
$.global.__HEEN_WIN = win;
win.show();

})();

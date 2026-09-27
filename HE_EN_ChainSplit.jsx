/* ============================================================================
 *  Kette auftrennen  –  Version 1.0.0
 *  Adobe InDesign 18.1 / ExtendScript
 *
 *  Trennt eine verkettete Textrahmenfolge an einer definierten Stelle auf UND
 *  nimmt den zugehoerigen Text in die neue Kette mit.
 *
 *  Hintergrund
 *  -----------
 *  Das blosse Loesen einer Verkettung (previousTextFrame = null) verschiebt in
 *  InDesign keinen Text: der gesamte Inhalt bleibt im vorderen Teil der Kette
 *  und wird dort zu Uebersatz, die abgekoppelten Rahmen sind leer. Dieses
 *  Script erledigt deshalb beides in der richtigen Reihenfolge:
 *    1. Zeichenindex der Trennstelle merken
 *    2. Kette loesen
 *    3. Textbereich von der Trennstelle bis zum Ende in die neue Kette bewegen
 *
 *  Alles laeuft in einem Undo-Schritt.
 * ========================================================================== */

#target "indesign"

(function () {

var TITLE = "Kette auftrennen";

/* ------------------------------------------------------------------ Hilfen */

function trim(s) { return String(s).replace(/^\s+/, "").replace(/\s+$/, ""); }

function snippet(t, n) {
    var s = String(t).replace(/[\r\n\u2028\u2029\t]/g, " ").replace(/\s+/g, " ");
    s = trim(s);
    return s.length > n ? s.substr(0, n) + "\u2026" : s;
}

/* Erster Rahmen einer Kette, der auf der angegebenen Seite liegt */
function firstChainFrameOnPage(page) {
    var items = page.allPageItems, best = null;
    for (var i = 0; i < items.length; i++) {
        var tf = items[i];
        if (!(tf instanceof TextFrame)) continue;
        try { if (!tf.previousTextFrame) continue; } catch (e) { continue; }
        try { if (tf.texts[0].characters.length === 0) continue; } catch (e) { continue; }
        if (!best || tf.geometricBounds[0] < best.geometricBounds[0]) best = tf;
    }
    return best;
}

/* Zweiter, andersartiger Kettenrahmen auf derselben Seite (Partnerspalte) */
function partnerFrameOnPage(page, notThisFrame) {
    var items = page.allPageItems, best = null;
    var ownStory = -1;
    try { ownStory = notThisFrame.parentStory.id; } catch (e) {}
    for (var i = 0; i < items.length; i++) {
        var tf = items[i];
        if (!(tf instanceof TextFrame) || tf === notThisFrame) continue;
        try {
            if (tf.parentStory.id === ownStory) continue;
            if (!tf.previousTextFrame) continue;
            if (tf.texts[0].characters.length < 20) continue;
        } catch (e) { continue; }
        if (!best || tf.texts[0].characters.length > best.texts[0].characters.length) best = tf;
    }
    return best;
}

/* ------------------------------------------------------------------ Kernroutine */

/*  tf          : Rahmen, der zum ersten Rahmen der neuen Kette werden soll
 *  moveText    : Text in die neue Kette uebernehmen
 *  snapToPara  : Trennstelle auf den Absatzanfang vorziehen, falls der Rahmen
 *                mitten in einem Absatz beginnt
 */
function splitChainAt(tf, moveText, snapToPara) {
    var res = { ok: false, msg: "", moved: 0, split: "" };

    if (!(tf && tf.isValid && tf instanceof TextFrame)) { res.msg = "Kein g\u00fcltiger Textrahmen."; return res; }

    var prev = null;
    try { prev = tf.previousTextFrame; } catch (e) {}
    if (!prev) { res.msg = "Der Rahmen ist bereits Anfang einer Kette."; return res; }

    var src = tf.parentStory;
    var startIdx = -1;

    try {
        if (tf.texts[0].characters.length > 0) startIdx = tf.texts[0].characters[0].index;
    } catch (e) {}

    if (startIdx < 0) {
        /* Rahmen enthaelt keinen Text – nur die Kette loesen, nichts zu bewegen */
        tf.previousTextFrame = null;
        res.ok = true;
        res.msg = "Kette gel\u00f6st (Rahmen war leer).";
        return res;
    }

    /* Beginnt der Rahmen mitten im Absatz? */
    var paraStart = startIdx, midPara = false;
    try {
        var p = src.characters[startIdx].paragraphs[0];
        paraStart = p.characters[0].index;
        midPara = (paraStart !== startIdx);
    } catch (e) {}

    if (midPara && snapToPara) startIdx = paraStart;

    var lastIdx = src.characters.length - 1;
    if (startIdx > lastIdx) { res.msg = "Trennstelle liegt hinter dem Textende."; return res; }

    res.split = snippet(src.characters.itemByRange(startIdx, Math.min(lastIdx, startIdx + 60)).contents, 55);
    res.moved  = lastIdx - startIdx + 1;

    /* 1. Kette loesen – der Text bleibt zunaechst vollstaendig in src */
    tf.previousTextFrame = null;

    /* 2. Textbereich in die neue, jetzt leere Kette bewegen */
    if (moveText) {
        var rng = src.characters.itemByRange(startIdx, lastIdx);
        try {
            rng.move(LocationOptions.AT_BEGINNING, tf.texts[0]);
        } catch (e1) {
            /* Ausweichweg fuer Sonderfaelle (verankerte Objekte, Tabellen) */
            try {
                rng.duplicate(LocationOptions.AT_BEGINNING, tf.texts[0]);
                rng.remove();
            } catch (e2) {
                res.msg = "Kette gel\u00f6st, aber der Text konnte nicht bewegt werden: " + e2;
                return res;
            }
        }
    }

    res.ok = true;
    res.msg = "Kette gel\u00f6st" + (moveText ? ", " + res.moved + " Zeichen \u00fcbernommen" : "") +
              (midPara ? (snapToPara ? " (auf Absatzanfang vorgezogen)" : " (ACHTUNG: mitten im Absatz)") : "");
    return res;
}

/* ------------------------------------------------------------------ Dialog */

function ask() {
    var doc = app.activeDocument;

    /* Vorbelegung aus der aktuellen Auswahl bzw. Cursorposition */
    var selFrame = null;
    try {
        var s = app.selection[0];
        if (s instanceof TextFrame) selFrame = s;
        else if (s && s.hasOwnProperty("parentTextFrames") && s.parentTextFrames.length) selFrame = s.parentTextFrames[0];
    } catch (e) {}

    var d = new Window("dialog", TITLE);
    d.orientation = "column"; d.alignChildren = "fill"; d.margins = 14; d.spacing = 9;

    var info = d.add("statictext", undefined,
        "Trennt die Verkettung so, da\u00df der gew\u00e4hlte Rahmen zum ERSTEN Rahmen einer\n" +
        "neuen Kette wird. Der Text ab dieser Stelle wandert mit.", { multiline: true });
    info.preferredSize = [430, 30];

    var pnl = d.add("panel", undefined, "Trennstelle");
    pnl.orientation = "column"; pnl.alignChildren = "left"; pnl.margins = 12; pnl.spacing = 7;

    var rSel = pnl.add("radiobutton", undefined, "Ausgew\u00e4hlter Rahmen / Rahmen mit dem Textcursor");
    var lblSel = pnl.add("statictext", undefined, "");
    lblSel.preferredSize = [400, 16];

    var gPg = pnl.add("group");
    var rPg = gPg.add("radiobutton", undefined, "Erster Kettenrahmen auf Seite:");
    var etPg = gPg.add("edittext", undefined, ""); etPg.preferredSize.width = 70;

    if (selFrame) {
        rSel.value = true;
        lblSel.text = "\u2192 " + snippet(selFrame.texts[0].contents, 60);
    } else {
        rPg.value = true;
        rSel.enabled = false;
        lblSel.text = "\u2192 nichts ausgew\u00e4hlt";
        try { etPg.text = String(app.activeWindow.activePage.name); } catch (e) {}
    }

    var pnl2 = d.add("panel", undefined, "Optionen");
    pnl2.orientation = "column"; pnl2.alignChildren = "left"; pnl2.margins = 12; pnl2.spacing = 7;
    var cbMove = pnl2.add("checkbox", undefined, "Text in die neue Kette \u00fcbernehmen");
    var cbSnap = pnl2.add("checkbox", undefined, "Trennstelle auf den Absatzanfang vorziehen");
    var cbPart = pnl2.add("checkbox", undefined, "Partnerspalte auf derselben Seite ebenfalls trennen");
    cbMove.value = true; cbSnap.value = true; cbPart.value = false;

    pnl2.add("statictext", undefined,
        "Ohne die erste Option bleibt der Text als \u00dcbersatz im vorderen Teil der Kette \u2013\n" +
        "das entspricht dem Verhalten von InDesign beim Doppelklick auf den Ausgang.",
        { multiline: true }).preferredSize = [400, 30];

    var g = d.add("group"); g.alignment = "right";
    var bCancel = g.add("button", undefined, "Abbrechen", { name: "cancel" });
    var bOK = g.add("button", undefined, "Trennen", { name: "ok" });

    if (d.show() !== 1) return null;

    var target = null;
    if (rSel.value && selFrame) target = selFrame;
    else {
        var nm = trim(etPg.text), page = null;
        for (var i = 0; i < doc.pages.length; i++) {
            if (String(doc.pages[i].name) === nm) { page = doc.pages[i]; break; }
        }
        if (!page) {
            var n = parseInt(nm, 10);
            if (!isNaN(n) && n >= 1 && n <= doc.pages.length) page = doc.pages[n - 1];
        }
        if (!page) { alert("Seite \u201e" + nm + "\u201c nicht gefunden."); return null; }
        target = firstChainFrameOnPage(page);
        if (!target) { alert("Auf Seite " + nm + " beginnt kein verketteter Rahmen."); return null; }
    }

    return { frame: target, move: cbMove.value, snap: cbSnap.value, partner: cbPart.value };
}

/* ------------------------------------------------------------------ Start */

if (app.documents.length === 0) { alert("Kein Dokument ge\u00f6ffnet."); return; }

var opt = ask();
if (!opt) return;

var report = [];

app.doScript(function () {
    var partner = null;
    if (opt.partner) {
        try { partner = partnerFrameOnPage(opt.frame.parentPage, opt.frame); } catch (e) {}
    }

    var r1 = splitChainAt(opt.frame, opt.move, opt.snap);
    report.push("Spalte 1: " + r1.msg + (r1.split ? "\n   ab: " + r1.split : ""));

    if (partner) {
        var r2 = splitChainAt(partner, opt.move, opt.snap);
        report.push("Spalte 2: " + r2.msg + (r2.split ? "\n   ab: " + r2.split : ""));
    } else if (opt.partner) {
        report.push("Spalte 2: keine zweite Kette auf dieser Seite gefunden.");
    }
}, ScriptLanguage.JAVASCRIPT, undefined, UndoModes.ENTIRE_SCRIPT, TITLE);

alert(report.join("\n\n") + "\n\nR\u00fcckg\u00e4ngig mit einem einzigen Undo-Schritt.", TITLE);

})();

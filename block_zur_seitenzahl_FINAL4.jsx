// =====================================================================
//  INHALTSBLOCK NACH AUSSEN ZUR SEITENZAHL AUSRICHTEN  (FINAL 4)
//  ---------------------------------------------------------------
//  NEU in FINAL4 - Durchgang 2 fuer Muster-Linien:
//   Auf Seiten mit nur einem Textrahmen wurden die Linien nie
//   ueberschrieben - sie liegen noch als Musterseiten-Objekte vor
//   und waren fuer das Skript unsichtbar. FINAL4 findet solche
//   Linien in den Musterelementen, ueberschreibt sie auf die Seite
//   und richtet sie an der AKTUELLEN Textblock-Kante aus.
//   -> Funktioniert auch nachtraeglich auf dem jetzigen Stand,
//      KEIN Zuruecksetzen aufs Backup noetig.
//
//  Durchgang 1 (wie FINAL3): alles ausser Kopfzeilen-Text und
//  seitenfuellenden Objekten wird buendig zur Seitenzahl geschoben.
//  Bereits buendige Seiten werden automatisch uebersprungen.
// =====================================================================

if (app.documents.length === 0) { alert("Kein Dokument geoeffnet."); exit(); }
var doc = app.activeDocument;

var oldH = doc.viewPreferences.horizontalMeasurementUnits;
var oldV = doc.viewPreferences.verticalMeasurementUnits;
doc.viewPreferences.horizontalMeasurementUnits = MeasurementUnits.MILLIMETERS;
doc.viewPreferences.verticalMeasurementUnits   = MeasurementUnits.MILLIMETERS;

// ==========================  EINSTELLUNGEN  ==========================
var kopfGrenzeY    = 13;    // mm: Kopfzone (Text hier = Kopfzeile, bleibt)
var randAnteil     = 0.90;  // Sicherheitsnetz: seitenfuellende Objekte bleiben
var maxLinienDicke = 2;     // mm: so duenn muss ein Muster-Objekt sein,
                            // um als Linie zu gelten (Durchgang 2)
var manuellerAussenabstand = 0;

var testModus       = false;                      // ERST TESTEN!
var testSeitenNamen = ["60", "61", "6", "7"];    // Seiten mit Einzelrahmen dabei
// =====================================================================

var seitenOK = 0, objekteBewegt = 0, entsperrt = 0, fehler = 0;
var musterLinienFix = 0;
var uebersprungen = [];

function istTestSeite(name) {
    for (var t = 0; t < testSeitenNamen.length; t++) {
        if (String(name) === String(testSeitenNamen[t])) return true;
    }
    return false;
}

function konkret(it) {
    try {
        var e = it.getElements();
        if (e && e.length > 0) return e[0];
    } catch (ex) {}
    return it;
}

function hatTextIrgendwo(obj) {
    try {
        if (obj.texts && obj.texts.length > 0 && obj.texts[0].characters.length > 0) {
            return true;
        }
    } catch (e0) {}
    try {
        var kinder = obj.allPageItems;
        for (var i = 0; i < kinder.length; i++) {
            try {
                var k = kinder[i];
                if (k.texts && k.texts.length > 0 && k.texts[0].characters.length > 0) {
                    return true;
                }
            } catch (e1) {}
        }
    } catch (e2) {}
    return false;
}

function kopfKanten(items, pTop, pLinks, pRechts, grenzeY) {
    var res = { ok: false, links: 9999999, rechts: -9999999 };
    for (var i = 0; i < items.length; i++) {
        var it = konkret(items[i]);
        var b;
        try { b = it.geometricBounds; } catch (e) { continue; }
        if (!b || b.length < 4) continue;
        if ((b[0] - pTop) >= grenzeY) continue;
        if (b[3] < pLinks - 1 || b[1] > pRechts + 1) continue;
        if (!hatTextIrgendwo(it)) continue;
        res.ok = true;
        if (b[1] < res.links)  res.links  = b[1];
        if (b[3] > res.rechts) res.rechts = b[3];
    }
    return res;
}

function verschiebe(obj, delta) {
    var warGesperrt = false, ebeneWarGesperrt = false, ebene = null;
    try { ebene = obj.itemLayer; } catch (eL) {}
    try {
        if (ebene && ebene.locked) { ebene.locked = false; ebeneWarGesperrt = true; }
        if (obj.locked) { obj.locked = false; warGesperrt = true; }

        obj.move(undefined, [delta, 0]);

        if (warGesperrt) { obj.locked = true; entsperrt++; }
        if (ebeneWarGesperrt && ebene) ebene.locked = true;
        return true;
    } catch (eV) {
        try { if (warGesperrt) obj.locked = true; } catch (e3) {}
        try { if (ebeneWarGesperrt && ebene) ebene.locked = true; } catch (e4) {}
        return false;
    }
}

for (var p = 0; p < doc.pages.length; p++) {
    var page = doc.pages[p];
    if (testModus && !istTestSeite(page.name)) continue;

    var pb   = page.bounds;
    var pTop = pb[0], pLinks = pb[1], pRechts = pb[3];
    var pBreite = pRechts - pLinks;
    var pHoehe  = pb[2] - pb[0];
    var istLinks = (page.side == PageSideOptions.LEFT_HAND);

    // ---------- Referenzkante ----------
    var zielKante = null;
    if (manuellerAussenabstand > 0) {
        zielKante = istLinks ? (pLinks + manuellerAussenabstand)
                             : (pRechts - manuellerAussenabstand);
    } else {
        var k = kopfKanten(page.pageItems, pTop, pLinks, pRechts, kopfGrenzeY);
        if (!k.ok) {
            try {
                var mI = page.masterPageItems;
                if (mI && mI.length > 0) {
                    k = kopfKanten(mI, pTop, pLinks, pRechts, kopfGrenzeY);
                }
            } catch (eM) {}
        }
        if (k.ok) {
            zielKante = istLinks ? k.links : k.rechts;
        } else {
            var mp = page.marginPreferences;
            zielKante = istLinks ? (pLinks + mp.left) : (pRechts - mp.right);
        }
    }

    // ---------- Durchgang 1: Seitenobjekte ----------
    var items = page.pageItems;
    var ziele = [];
    var blockLinks = 9999999, blockRechts = -9999999;
    var hatText = false;

    for (var i = 0; i < items.length; i++) {
        var it = konkret(items[i]);
        var b;
        try { b = it.geometricBounds; } catch (e) { continue; }
        if (!b || b.length < 4) continue;

        var top    = b[0] - pTop;
        var hoehe  = b[2] - b[0];
        var breite = b[3] - b[1];
        var mitText = hatTextIrgendwo(it);

        if (top < kopfGrenzeY && mitText) continue;                       // Kopfzeile
        if (breite >= randAnteil * pBreite && hoehe >= randAnteil * pHoehe) continue;

        ziele.push(it);
        if (mitText && top >= kopfGrenzeY) {
            hatText = true;
            if (b[1] < blockLinks)  blockLinks  = b[1];
            if (b[3] > blockRechts) blockRechts = b[3];
        }
    }

    if (!hatText || ziele.length === 0) {
        uebersprungen.push(page.name);
        continue;
    }

    var delta = istLinks ? (zielKante - blockLinks)
                         : (zielKante - blockRechts);

    if (Math.abs(delta) >= 0.01) {
        for (var z = 0; z < ziele.length; z++) {
            if (verschiebe(ziele[z], delta)) objekteBewegt++;
            else fehler++;
        }
        // Blockkanten nach dem Verschieben aktualisieren (fuer Durchgang 2)
        blockLinks  += delta;
        blockRechts += delta;
    }
    seitenOK++;

    // ---------- Durchgang 2: nicht ueberschriebene MUSTER-LINIEN ----------
    // Linienfoermige Musterelemente unterhalb der Kopfzone werden auf die
    // Seite ueberschrieben und an die aktuelle Textblock-Kante gerueckt.
    try {
        var mItems = page.masterPageItems;
        if (mItems && mItems.length > 0) {
            var mLinien = [];
            var mLinks = 9999999, mRechts = -9999999;

            for (var m = 0; m < mItems.length; m++) {
                var mit = konkret(mItems[m]);
                var mb;
                try { mb = mit.geometricBounds; } catch (e5) { continue; }
                if (!mb || mb.length < 4) continue;

                var mTop    = mb[0] - pTop;
                var mHoehe  = mb[2] - mb[0];
                var mBreite = mb[3] - mb[1];

                if (mTop < kopfGrenzeY) continue;                 // Kopfbereich
                if (mb[3] < pLinks - 1 || mb[1] > pRechts + 1) continue;
                if (mHoehe > maxLinienDicke && mBreite > maxLinienDicke) continue;

                mLinien.push(mItems[m]);   // Original-Referenz fuer override()
                if (mb[1] < mLinks)  mLinks  = mb[1];
                if (mb[3] > mRechts) mRechts = mb[3];
            }

            if (mLinien.length > 0) {
                var deltaM = istLinks ? (blockLinks - mLinks)
                                      : (blockRechts - mRechts);
                if (Math.abs(deltaM) >= 0.01) {
                    for (var q = 0; q < mLinien.length; q++) {
                        try {
                            var ov = mLinien[q].override(page);   // auf Seite holen
                            if (verschiebe(ov, deltaM)) musterLinienFix++;
                            else fehler++;
                        } catch (eO) { fehler++; }
                    }
                }
            }
        }
    } catch (eMP) {}
}

doc.viewPreferences.horizontalMeasurementUnits = oldH;
doc.viewPreferences.verticalMeasurementUnits   = oldV;

var meldung = "Fertig.\n"
    + "Bearbeitete Seiten: " + seitenOK + "\n"
    + "Verschobene Objekte (Durchgang 1): " + objekteBewegt + "\n"
    + "Nachgezogene Muster-Linien (Durchgang 2): " + musterLinienFix + "\n";
if (entsperrt > 0) meldung += "Temporaer entsperrt: " + entsperrt + "\n";
if (fehler > 0)    meldung += "Fehler: " + fehler + "\n";
if (uebersprungen.length > 0) {
    var liste = uebersprungen.join(", ");
    if (liste.length > 600) liste = liste.substring(0, 600) + " ...";
    meldung += "Uebersprungen (kein Inhalt): " + uebersprungen.length
             + " Seiten\n[" + liste + "]";
}
if (testModus) meldung += "\nTEST-Modus: " + testSeitenNamen.join(", ");
alert(meldung);

#target "InDesign"
#targetengine "InDesignLayoutToolkit_v214"

/*
    InDesign Layout Extractor v2.14.0 LITE+
    Build: 2026-08-09-calibrated-pagination-r1
    Target: Adobe InDesign 18.1 / ExtendScript

    Combined InDesign 18.1 toolkit:
    - fast layout analysis/export
    - new-document reconstruction
    - consolidated typography, HTML-tag, Hebrew and Unicode text tools
    - modeless always-available ScriptUI palette
    - TXT book builder: title page, semantic structure, flexible frame grids and Tzurba-style colors
    - v2.2.0: UI reorganised into sections. No scrollbar is needed any more, because
      no tab is taller than the window. Each main tab holds a small inner tabbedpanel;
      ScriptUI shows exactly one section at a time, which is native behaviour and does
      not depend on clipping, manual positioning or visibility juggling.
    - v2.2.0: saved as UTF-8 WITH BOM so German umlauts render correctly in ExtendScript
    - v2.3.0: professional TXT routing to existing parent/master-page text frames; title/frontmatter/body can use different masters and frame slots
    - v2.4.0: independent Roman/Arabic section routing for title/frontmatter/body; clean v2.2 title/frontmatter modes restored
    - v2.5.0: new FAST typography engine; old character-by-character engine is preserved unchanged
    - v2.6.0: explicit TXT split preview/manual routing; optional OpenAI Responses API preface generator
    - v2.7.0: automatic TXT footnote parser and native InDesign footnote creation with configurable document footnote options
    - v2.8.0: TURBO large-file import: prelinked page blocks, chunked story insertion, deferred footnotes, batched recomposition and reserve trimming
    - v2.9.0: BULK RTF footnote bridge: one native InDesign RTF import replaces thousands of Footnotes.add() calls; v2.8 remains fallback
    - v2.10.0: Story-level overset postflight; automatic continuation until Story.overflows=false; repair command for already imported books
    - v2.11.0: dedicated import typography controls; relative footnote sizing; plain <sup>...</sup> support in old and FAST engines
    - v2.12.0: true LIVE parent/master rescan; point-safe geometry; resolved text-frame collections; TEXT/KOPF/PAGINA roles; stable routing sort
    - v2.13.0: Hebrew import fast path: one paragraph-style bulk apply for pure Hebrew; source-aware HTML GREP; no redundant Hebrew style scans
    - v2.14.0: calibrated pagination after final import typography; semantic headings via targeted GREP; live real-page progress
    - v2.14.1: Seitenbereich "Alle Seiten des Dokuments" (Standard); Radiobuttons des Seitenbereichs sicher gegenseitig exklusiv

    LAYOUT SCAN PRINCIPLES:
    - NO allPageItems
    - NO Story access
    - NO loops through characters / paragraphs / textStyleRanges
    - At most first character/paragraph on USED parent/master text frames
    - NO full text contents on document pages
    - NO styles/fonts/links/swatches inventory
    - Typography is read ONLY from text frames on used parent/master pages
    - NO typography/text scan on normal document pages
    - By default ONLY parent/master spreads actually used by selected pages
    - Selected pages are scanned by direct object collections only
    - JSON is deliberately small and compact
    - A tiny .log file is written incrementally so a stall can be located
*/

(function () {
    var SCRIPT_NAME = "InDesign Layout Extractor LITE+";
    var SCRIPT_VERSION = "2.14.1";
    var BUILD = "2026-09-26-all-pages-r1";
    var PT_TO_MM = 25.4 / 72.0;

    showToolkitPalette();

    // ---------------- UI ----------------

    function showToolkitPalette() {
        try {
            var prev = $.global.__ID_LAYOUT_TOOLKIT_V214__;
            if (prev && prev.visible) {
                if (prev.__toolkitBuild === BUILD) {
                    prev.active = true;
                    return;
                }
                // Noch offene Palette aus einem aelteren Build schliessen,
                // sonst wuerde nur das alte Fenster nach vorn geholt.
                try { prev.close(); } catch (_) {}
                $.global.__ID_LAYOUT_TOOLKIT_V214__ = null;
            }
        } catch (_) {}
        var w = new Window("palette", SCRIPT_NAME + " v" + SCRIPT_VERSION, undefined, {resizeable:true});
        try { w.__toolkitBuild = BUILD; } catch (_) {}
        try { $.global.__ID_LAYOUT_TOOLKIT_V214__ = w; } catch (_) {}
        w.orientation = "column";
        w.alignChildren = "fill";
        w.margins = 12;
        w.spacing = 8;
        w.minimumSize = [880, 380];
        w.preferredSize = [920, 560];

        var tabs = w.add("tabbedpanel");
        tabs.alignChildren = ["fill", "fill"];
        tabs.alignment = ["fill", "fill"];
        tabs.minimumSize = [860, 300];
        tabs.preferredSize = [900, 470];

        // =================================================================
        // AUFTEILUNG IN ABSCHNITTE (statt Scrollbalken)
        //
        // ScriptUI in InDesign 18.1 hat keinen echten Scroll-Container:
        // ein Panel schneidet ueberstehende Kinder nicht zuverlaessig ab,
        // der Layoutmanager setzt manuell gesetzte Positionen zurueck, und
        // ausgeblendete Kinder geben ihren Platz erst nach einem vollen
        // Layout-Durchgang frei - der wiederum das Fenster neu dimensioniert.
        // Jede Scroll-Loesung kaempft also gegen das Framework.
        //
        // Deshalb wird das Problem an der Wurzel geloest: kein Reiter ist
        // mehr hoeher als das Fenster. Jeder Hauptreiter enthaelt ein kleines
        // inneres Register mit fachlich zusammengehoerenden Abschnitten.
        // Das Umschalten uebernimmt ScriptUI selbst - garantiert stabil,
        // ohne Messen, ohne Tricks, und in jeder Fenstergroesse.
        // =================================================================

        function makeSection(host, title, spacing) {
            var sec = host.add("tab", undefined, title);
            sec.orientation = "column";
            sec.alignChildren = "fill";
            sec.margins = 12;
            sec.spacing = spacing ? spacing : 9;
            return sec;
        }

        function makeSectionHost(tab) {
            tab.orientation = "column";
            tab.alignChildren = ["fill", "fill"];
            tab.margins = 6;
            tab.spacing = 0;
            var host = tab.add("tabbedpanel");
            host.alignChildren = ["fill", "fill"];
            host.alignment = ["fill", "fill"];
            return host;
        }

        // -----------------------------------------------------------------
        // TAB 1: current read/export workflow
        // -----------------------------------------------------------------
        var readTab = tabs.add("tab", undefined, "Dokumentenlayout auslesen");
        var readSub  = makeSectionHost(readTab);
        var readSecA = makeSection(readSub, "Dokument & Export", 9);
        var readSecB = makeSection(readSub, "Seitenbereich & Abschnitte", 9);
        var readSecC = makeSection(readSub, "Muster-/Elternseiten & Rahmen", 9);

        var t = readSecA.add("statictext", undefined,
            "Schneller Layout-Scan. Normale Buchseiten: nur Geometrie. Verwendete Muster-/Elternseiten: zusätzlich gezielte Typografie. Abschnitte und Seitennummerierung werden separat und sehr schnell erfasst.",
            {multiline:true});
        t.preferredSize.width = 660;

        var dp = readSecA.add("panel", undefined, "Dokument");
        dp.orientation = "row";
        dp.margins = 10;
        dp.add("statictext", undefined, "Dokument:");
        var names = [], active = 0, i;
        for (i = 0; i < app.documents.length; i++) {
            names.push(app.documents[i].name);
            try { if (app.documents[i] === app.activeDocument) active = i; } catch (_) {}
        }
        if (names.length === 0) names.push("— kein Dokument geöffnet —");
        var dd = dp.add("dropdownlist", undefined, names);
        dd.preferredSize.width = 510;
        dd.selection = Math.min(active, names.length - 1);

        var fp = readSecA.add("panel", undefined, "Exportordner");
        fp.orientation = "row";
        fp.margins = 10;
        var fe = fp.add("edittext", undefined, app.documents.length ? defaultFolder(app.activeDocument) : Folder.desktop.fsName);
        fe.characters = 61;
        var fb = fp.add("button", undefined, "Auswählen …");
        fb.onClick = function () {
            var f = Folder.selectDialog("Exportordner auswählen");
            if (f) fe.text = f.fsName;
        };

        var pp = readSecB.add("panel", undefined, "Seitenbereich");
        pp.orientation = "column";
        pp.alignChildren = "left";
        pp.margins = 10;
        pp.spacing = 6;

        var allRadio = pp.add("radiobutton", undefined, "Alle Seiten des Dokuments");
        var allInfo = pp.add("statictext", undefined, "", {multiline:false});
        allInfo.preferredSize.width = 640;
        function updateAllInfo() {
            try {
                if (!app.documents.length) { allInfo.text = "(kein Dokument geöffnet)"; return; }
                var dAll = app.documents[dd.selection ? dd.selection.index : 0];
                allInfo.text = "   → physische Seiten 1–" + dAll.pages.length + " von „" + dAll.name + "“";
            } catch (_) { allInfo.text = ""; }
        }
        updateAllInfo();

        var firstRadio = pp.add("radiobutton", undefined, "Nur die ersten N physischen Seiten");
        var fg = pp.add("group");
        fg.add("statictext", undefined, "N:");
        var nEdit = fg.add("edittext", undefined, "10");
        nEdit.characters = 6;

        var rangeRadio = pp.add("radiobutton", undefined, "Freier physischer Bereich");
        var rg = pp.add("group");
        rg.add("statictext", undefined, "von:");
        var fromEdit = rg.add("edittext", undefined, "1");
        fromEdit.characters = 6;
        rg.add("statictext", undefined, "bis:");
        var toEdit = rg.add("edittext", undefined, "10");
        toEdit.characters = 6;
        function setPageMode(m) {
            allRadio.value = (m === "all");
            firstRadio.value = (m === "first");
            rangeRadio.value = (m === "range");
            nEdit.enabled = (m === "first");
            fromEdit.enabled = (m === "range");
            toEdit.enabled = (m === "range");
        }
        setPageMode("all");

        var note = pp.add("statictext", undefined,
            "Die Auswahl erfolgt nach physischer Dokumentposition. Sichtbare Seitennamen wie II, vi oder 499 werden zusätzlich im JSON gespeichert.",
            {multiline:true});
        note.preferredSize.width = 640;

        var sp = readSecB.add("panel", undefined, "Abschnitte / Seitennummerierung");
        sp.orientation = "column";
        sp.alignChildren = "left";
        sp.margins = 10;
        var incSections = sp.add("checkbox", undefined, "Gesamte Abschnitts- und Seitennummerierungsstruktur auslesen");
        incSections.value = true;
        var secNote = sp.add("statictext", undefined,
            "Erfasst u. a. Abschnittsstart/-ende, römisch/arabisch, Startwert, Fortsetzung, Präfix und Section Marker. Dieser Scan ist sehr klein und betrifft nur die InDesign-Abschnittsobjekte.",
            {multiline:true});
        secNote.preferredSize.width = 640;

        var mp = readSecC.add("panel", undefined, "Muster-/Elternseiten");
        mp.orientation = "column";
        mp.alignChildren = "left";
        mp.margins = 10;
        var incMasters = mp.add("checkbox", undefined, "Nur auf den ausgewählten Seiten verwendete Muster-/Elternseiten auslesen");
        incMasters.value = true;
        var incChain = mp.add("checkbox", undefined, "Zusätzlich deren Basis-Musterseiten einbeziehen");
        incChain.value = true;
        var incMasterContents = mp.add("checkbox", undefined, "Kurzen Inhalt von Musterseiten-Textrahmen mitlesen (für Pagina/Kopfzeile)");
        incMasterContents.value = true;
        var incMasterTypography = mp.add("checkbox", undefined, "Typografie der Musterseiten-Textrahmen auslesen (Font, Größe, Absatzformat usw.)");
        incMasterTypography.value = true;

        var bp = readSecC.add("panel", undefined, "Rahmentypen");
        bp.orientation = "row";
        bp.margins = 10;
        var tf = bp.add("checkbox", undefined, "Textrahmen"); tf.value = true;
        var shapes = bp.add("checkbox", undefined, "Grafikrahmen/Formen"); shapes.value = true;
        var lines = bp.add("checkbox", undefined, "Linien"); lines.value = true;
        var groups = bp.add("checkbox", undefined, "Gruppen als Außenrahmen"); groups.value = true;

        // -----------------------------------------------------------------
        // TAB 2: prepared create-document workflow with TWO source modes
        // -----------------------------------------------------------------
        var createTab = tabs.add("tab", undefined, "Neues Dokument anlegen");
        var createSub  = makeSectionHost(createTab);
        var createSecA = makeSection(createSub, "Layout-Quelle", 10);
        var createSecB = makeSection(createSub, "Neues Zieldokument", 10);

        var ct = createSecA.add("statictext", undefined,
            "Hier wird die spätere Rückrichtung vorbereitet: Ein neues InDesign-Dokument soll entweder aus einer gespeicherten Layout-JSON oder direkt aus den Einstellungen des ersten Reiters aufgebaut werden.",
            {multiline:true});
        ct.preferredSize.width = 680;

        var srcPanel = createSecA.add("panel", undefined, "Layout-Quelle");
        srcPanel.orientation = "column";
        srcPanel.alignChildren = "fill";
        srcPanel.margins = 10;
        srcPanel.spacing = 7;

        var srcFileRadio = srcPanel.add("radiobutton", undefined, "Layout-JSON aus Datei laden");
        var srcFileRow = srcPanel.add("group");
        srcFileRow.add("statictext", undefined, "JSON-Datei:");
        var srcEdit = srcFileRow.add("edittext", undefined, "");
        srcEdit.characters = 48;
        var srcBtn = srcFileRow.add("button", undefined, "Auswählen …");
        srcBtn.onClick = function () {
            var f = File.openDialog("Layout-JSON auswählen", "JSON:*.json");
            if (f) srcEdit.text = f.fsName;
        };

        var srcReadRadio = srcPanel.add("radiobutton", undefined, "Direkt aus Reiter „Dokumentenlayout auslesen“ übernehmen (ohne Zwischen-JSON)");
        srcReadRadio.value = true;

        var takePanel = srcPanel.add("panel", undefined, "Übernahme aus Reiter 1");
        takePanel.orientation = "column";
        takePanel.alignChildren = "fill";
        takePanel.margins = 8;
        var takeSummary = takePanel.add("statictext", undefined, "", {multiline:true});
        takeSummary.preferredSize = [650, 78];
        var takeRow = takePanel.add("group");
        takeRow.alignment = "left";
        var takeBtn = takeRow.add("button", undefined, "Aktuelle Auswahl aus Reiter 1 übernehmen");
        var takeStatus = takeRow.add("statictext", undefined, "Noch nicht übernommen");

        var targetPanel = createSecB.add("panel", undefined, "Neues Zieldokument");
        targetPanel.orientation = "column";
        targetPanel.alignChildren = "left";
        targetPanel.margins = 10;
        targetPanel.spacing = 6;
        var nameRow = targetPanel.add("group");
        nameRow.add("statictext", undefined, "Dokumentname:");
        var newName = nameRow.add("edittext", undefined, "Neues_Dokument.indd");
        newName.characters = 40;

        var outRow = targetPanel.add("group");
        outRow.add("statictext", undefined, "Speicherordner:");
        var createFolderEdit = outRow.add("edittext", undefined, fe.text);
        createFolderEdit.characters = 47;
        var createFolderBtn = outRow.add("button", undefined, "Auswählen …");
        createFolderBtn.onClick = function () {
            var f = Folder.selectDialog("Speicherordner für das neue Dokument auswählen");
            if (f) createFolderEdit.text = f.fsName;
        };

        var saveCreated = targetPanel.add("checkbox", undefined, "Dokument nach dem Anlegen direkt als .indd speichern");
        saveCreated.value = true;

        var c1 = targetPanel.add("checkbox", undefined, "Seitenformat und Doppelseiten übernehmen"); c1.value = true;
        var c2 = targetPanel.add("checkbox", undefined, "Abschnitte und Seitennummerierung übernehmen"); c2.value = true;
        var c3 = targetPanel.add("checkbox", undefined, "Muster-/Elternseiten und Rahmen rekonstruieren"); c3.value = true;
        var c4 = targetPanel.add("checkbox", undefined, "Musterseiten-Typografie übernehmen"); c4.value = true;

        var futureNote = createSecB.add("statictext", undefined,
            "In dieser Version wird bereits ein neues InDesign-Dokument erzeugt. Quelle kann eine Layout-JSON-Datei oder direkt die aktuelle Auswahl aus Reiter 1 sein.",
            {multiline:true});
        futureNote.preferredSize.width = 680;

        var capturedFirstTab = null;

        function currentReadSelectionSnapshot() {
            if (app.documents.length === 0) throw new Error("Kein Dokument geöffnet.");
            var docIndexNow = dd.selection ? dd.selection.index : 0;
            var dNow = app.documents[docIndexNow];
            var totalNow = dNow.pages.length;
            var aNow = 1, bNow = 1;
            if (allRadio.value) {
                aNow = 1; bNow = totalNow;
            } else if (firstRadio.value) {
                var nNow = parseInt(nEdit.text, 10);
                if (isNaN(nNow) || nNow < 1) nNow = 10;
                if (nNow > totalNow) nNow = totalNow;
                aNow = 1; bNow = nNow;
            } else {
                aNow = parseInt(fromEdit.text, 10);
                bNow = parseInt(toEdit.text, 10);
                if (isNaN(aNow) || aNow < 1) aNow = 1;
                if (isNaN(bNow) || bNow < aNow) bNow = aNow;
                if (aNow > totalNow) aNow = totalNow;
                if (bNow > totalNow) bNow = totalNow;
            }
            return {
                docIndex: docIndexNow,
                docName: dNow.name,
                totalPages: totalNow,
                startPhysical: aNow,
                endPhysical: bNow,
                includeSections: incSections.value,
                includeMasters: incMasters.value,
                includeBasedOnMasters: incChain.value,
                includeMasterTextContents: incMasterContents.value,
                includeMasterTypography: incMasterTypography.value,
                textFrames: tf.value,
                shapes: shapes.value,
                lines: lines.value,
                groups: groups.value
            };
        }

        function snapshotText(x) {
            if (!x) return "Dokument: —\nSeitenbereich: —\nQuelle: noch nicht übernommen";
            return "Dokument: " + x.docName + "  (" + x.totalPages + " Seiten)\n" +
                   "Physischer Bereich: " + x.startPhysical + "–" + x.endPhysical + "\n" +
                   "Abschnitte: " + (x.includeSections ? "ja" : "nein") +
                   "   ·   Musterseiten: " + (x.includeMasters ? "ja" : "nein") +
                   "   ·   Muster-Typografie: " + (x.includeMasterTypography ? "ja" : "nein");
        }

        function refreshLiveReadSummary() {
            if (capturedFirstTab) return;
            try { takeSummary.text = snapshotText(currentReadSelectionSnapshot()); } catch (_) {}
        }

        takeBtn.onClick = function () {
            try {
                capturedFirstTab = currentReadSelectionSnapshot();
                takeSummary.text = snapshotText(capturedFirstTab);
                takeStatus.text = "Übernommen";
                srcReadRadio.value = true;
                updateCreateSourceState();
            } catch (e) {
                alert("Übernahme aus Reiter 1 nicht möglich:\n\n" + errText(e), SCRIPT_NAME);
            }
        };

        function updateCreateSourceState() {
            var fileMode = srcFileRadio.value;
            srcEdit.enabled = fileMode;
            srcBtn.enabled = fileMode;
            takePanel.enabled = !fileMode;
        }
        srcFileRadio.onClick = updateCreateSourceState;
        srcReadRadio.onClick = updateCreateSourceState;

        // Keep the live preview in sync until the user explicitly snapshots it.
        dd.onChange = function () { updateAllInfo(); refreshLiveReadSummary(); };
        allRadio.onClick = function () { setPageMode("all"); refreshLiveReadSummary(); };
        firstRadio.onClick = function () { setPageMode("first"); refreshLiveReadSummary(); };
        rangeRadio.onClick = function () { setPageMode("range"); refreshLiveReadSummary(); };
        nEdit.onChanging = refreshLiveReadSummary;
        fromEdit.onChanging = refreshLiveReadSummary;
        toEdit.onChanging = refreshLiveReadSummary;
        incSections.onClick = refreshLiveReadSummary;
        incMasters.onClick = refreshLiveReadSummary;
        incChain.onClick = refreshLiveReadSummary;
        incMasterContents.onClick = refreshLiveReadSummary;
        incMasterTypography.onClick = refreshLiveReadSummary;
        tf.onClick = refreshLiveReadSummary;
        shapes.onClick = refreshLiveReadSummary;
        lines.onClick = refreshLiveReadSummary;
        groups.onClick = refreshLiveReadSummary;

        updateCreateSourceState();
        refreshLiveReadSummary();

        // -----------------------------------------------------------------
        // TAB 3: consolidated text tools from the supplied JSX utilities
        // -----------------------------------------------------------------
        var toolsTab = tabs.add("tab", undefined, "Text- & Hebräisch-Werkzeuge");
        var toolsSub  = makeSectionHost(toolsTab);
        var toolsSecA = makeSection(toolsSub, "Typografie & HTML-Tags", 9);
        var toolsSecB = makeSection(toolsSub, "Hebräisch & Transkription", 9);
        var toolsSecC = makeSection(toolsSub, "Unicode & Sicherheit", 9);

        var toolsIntro = toolsSecA.add("statictext", undefined,
            "Zusammengefasste und für InDesign 18.1 reorganisierte Textwerkzeuge. Die Format-Presets basieren auf der erprobten Keter-YG/Cambria-9-pt-Datei; alle Änderungen laufen als eine Undo-Stufe.",
            {multiline:true});
        toolsIntro.preferredSize.width = 680;

        var formatPanel = toolsSecA.add("panel", undefined, "Typografie & HTML-Tags");
        formatPanel.orientation = "column";
        formatPanel.alignChildren = "left";
        formatPanel.margins = 10;
        formatPanel.spacing = 6;

        var fmtRadio = formatPanel.add("radiobutton", undefined, "Format-/Tag-Preset auf ausgewählten Text anwenden");
        fmtRadio.value = true;
        var presetRow = formatPanel.add("group");
        presetRow.add("statictext", undefined, "Preset:");
        var presetDD = presetRow.add("dropdownlist", undefined, [
            "Keter YG + Cambria · 9 pt · Blocksatz (Referenz)",
            "9 pt + Tags · <small>=8 pt · <sup>=hochgestellt · <i>=kursiv · Blocksatz",
            "14/8/18 pt + Tags · Blocksatz · 2 Durchläufe",
            "14/10/18 pt + Tags · zentriert · 2 Durchläufe"
        ]);
        presetDD.selection = 0;
        presetDD.preferredSize.width = 520;

        var customRow = formatPanel.add("group");
        customRow.add("statictext", undefined, "Basis:");
        var baseSizeEdit = customRow.add("edittext", undefined, "9"); baseSizeEdit.characters = 4;
        customRow.add("statictext", undefined, "small:");
        var smallSizeEdit = customRow.add("edittext", undefined, "8"); smallSizeEdit.characters = 4;
        customRow.add("statictext", undefined, "big:");
        var bigSizeEdit = customRow.add("edittext", undefined, "18"); bigSizeEdit.characters = 4;
        customRow.add("statictext", undefined, "Ausrichtung:");
        var alignDD = customRow.add("dropdownlist", undefined, ["Blocksatz · letzte Zeile links", "zentriert"]); alignDD.selection = 0;

        var fmtOptions = formatPanel.add("group");
        var tagsCheck = fmtOptions.add("checkbox", undefined, "HTML-Tags verarbeiten: <br>, <small>, <big>, <b>, <i>, <sup>"); tagsCheck.value = false;
        var twoPassCheck = fmtOptions.add("checkbox", undefined, "2 Durchläufe + Recompose"); twoPassCheck.value = false;
        var old8to10 = fmtOptions.add("checkbox", undefined, "Altbestand 8 pt → 10 pt"); old8to10.value = false;
        var legacyStylesCheck = formatPanel.add("checkbox", undefined, "Zeichenformate „Klein“ / „Kursiv“ anlegen und verwenden (h11ptTags-Kompatibilität)");
        legacyStylesCheck.value = false;
        var oldSupInfo = formatPanel.add("statictext", undefined,
            "<sup>…</sup> wird als echte InDesign-Hochstellung formatiert. Attributierte Fußnotenmarker wie <sup class=\"footnote-marker\"> bleiben davon getrennt.",
            {multiline:true});
        oldSupInfo.preferredSize.width = 720;

        function applyPresetUI() {
            var idx = presetDD.selection ? presetDD.selection.index : 0;
            if (idx === 0) {
                baseSizeEdit.text = "9"; smallSizeEdit.text = "8"; bigSizeEdit.text = "18";
                alignDD.selection = 0; tagsCheck.value = false; twoPassCheck.value = false; old8to10.value = false; legacyStylesCheck.value = false;
            } else if (idx === 1) {
                baseSizeEdit.text = "9"; smallSizeEdit.text = "8"; bigSizeEdit.text = "18";
                alignDD.selection = 0; tagsCheck.value = true; twoPassCheck.value = false; old8to10.value = false; legacyStylesCheck.value = true;
            } else if (idx === 2) {
                baseSizeEdit.text = "14"; smallSizeEdit.text = "8"; bigSizeEdit.text = "18";
                alignDD.selection = 0; tagsCheck.value = true; twoPassCheck.value = true; old8to10.value = false; legacyStylesCheck.value = false;
            } else {
                baseSizeEdit.text = "14"; smallSizeEdit.text = "10"; bigSizeEdit.text = "18";
                alignDD.selection = 1; tagsCheck.value = true; twoPassCheck.value = true; old8to10.value = true; legacyStylesCheck.value = false;
            }
        }
        presetDD.onChange = applyPresetUI;

        var hebPanel = toolsSecB.add("panel", undefined, "Hebräisch bereinigen");
        hebPanel.orientation = "column";
        hebPanel.alignChildren = "left";
        hebPanel.margins = 10;
        hebPanel.spacing = 5;
        var nikkudRadio = hebPanel.add("radiobutton", undefined, "Nikkud + Teamim aus ausgewähltem Text entfernen (Satzzeichen bleiben)");
        var dageshRadio = hebPanel.add("radiobutton", undefined, "Dagesch U+05BC aus ausgewähltem Text entfernen");
        var shinRadio = hebPanel.add("radiobutton", undefined, "Shin-Präsentationsform U+FB2A → ש + Shin-Punkt normalisieren");

        var transPanel = toolsSecB.add("panel", undefined, "Transkription");
        transPanel.orientation = "column";
        transPanel.alignChildren = "left";
        transPanel.margins = 10;
        var transRadio = transPanel.add("radiobutton", undefined, "Einfache Hebräisch→Latein-Transkription in [Klammern] hinter Auswahl einfügen");
        var transRow = transPanel.add("group");
        transRow.add("statictext", undefined, "Schrift:");
        var transFontEdit = transRow.add("edittext", undefined, "Cambria"); transFontEdit.characters = 18;
        transRow.add("statictext", undefined, "Größe:");
        var transSizeEdit = transRow.add("edittext", undefined, "6"); transSizeEdit.characters = 4;
        transRow.add("statictext", undefined, "pt");

        var unicodePanel = toolsSecC.add("panel", undefined, "Unicode-Escapes");
        unicodePanel.orientation = "column";
        unicodePanel.alignChildren = "left";
        unicodePanel.margins = 10;
        var unicodeRadio = unicodePanel.add("radiobutton", undefined, "\\uXXXX-Escapes in echte Unicode-Zeichen umwandeln");
        var unicodeRow = unicodePanel.add("group");
        unicodeRow.add("statictext", undefined, "Bereich:");
        var unicodeScopeDD = unicodeRow.add("dropdownlist", undefined, ["nur ausgewählter Text", "gesamtes aktives Dokument"]);
        unicodeScopeDD.selection = 0;

        function chooseToolRadio(which) {
            fmtRadio.value = (which === "format");
            nikkudRadio.value = (which === "nikkud");
            dageshRadio.value = (which === "dagesh");
            shinRadio.value = (which === "shin");
            transRadio.value = (which === "transliteration");
            unicodeRadio.value = (which === "unicode");
        }
        fmtRadio.onClick = function () { chooseToolRadio("format"); };
        nikkudRadio.onClick = function () { chooseToolRadio("nikkud"); };
        dageshRadio.onClick = function () { chooseToolRadio("dagesh"); };
        shinRadio.onClick = function () { chooseToolRadio("shin"); };
        transRadio.onClick = function () { chooseToolRadio("transliteration"); };
        unicodeRadio.onClick = function () { chooseToolRadio("unicode"); };

        var safetyPanel = toolsSecC.add("panel", undefined, "Sicherheit / InDesign 18.1");
        safetyPanel.orientation = "column";
        safetyPanel.alignChildren = "left";
        safetyPanel.margins = 10;
        safetyPanel.add("statictext", undefined,
            "Find/Change-Einstellungen werden vor und nach GREP-Aktionen zurückgesetzt. Fontnamen werden mit Fallbacks aufgelöst; der World-Ready Composer verwendet denselben Fallback wie die erprobte Referenzdatei.",
            {multiline:true}).preferredSize.width = 650;

        // -----------------------------------------------------------------
        // NEW FAST TAB: native bulk formatting / GREP engine.
        // The old text-tools tab above remains intentionally unchanged.
        // -----------------------------------------------------------------
        var fastTab = tabs.add("tab", undefined, "Schnellformatierung");
        var fastSub  = makeSectionHost(fastTab);
        var fastSecA = makeSection(fastSub, "Bereich & Engine", 9);
        var fastSecB = makeSection(fastSub, "Typografie", 9);
        var fastSecC = makeSection(fastSub, "FAST HTML & Hebräisch", 9);

        var fastIntro = fastSecA.add("statictext", undefined,
            "Neue Hochgeschwindigkeits-Engine: keine Zeichen- oder Absatzschleifen. Ganze Textbereiche werden gesammelt formatiert; Hebräisch und Tags laufen über InDesign-natives GREP. Der alte Reiter bleibt als kompatibler Fallback erhalten.",
            {multiline:true});
        fastIntro.preferredSize.width = 760;

        var fastScopePanel = fastSecA.add("panel", undefined, "Arbeitsbereich");
        fastScopePanel.orientation = "column";
        fastScopePanel.alignChildren = "left";
        fastScopePanel.margins = 10;
        fastScopePanel.spacing = 7;
        var fastScopeRow = fastScopePanel.add("group");
        fastScopeRow.add("statictext", undefined, "Bereich:");
        var fastScopeDD = fastScopeRow.add("dropdownlist", undefined, [
            "Ausgewählter Text",
            "Aktuelle Story der Auswahl · empfohlen",
            "Längste Story im Dokument · typischer Buchtext",
            "Alle Stories im Dokument · Story für Story"
        ]);
        fastScopeDD.selection = 1;
        fastScopeDD.preferredSize.width = 455;
        var fastScopeInfoBtn = fastScopeRow.add("button", undefined, "Bereich prüfen");

        var fastAllStoriesRow = fastScopePanel.add("group");
        var fastMinCharsCheck = fastAllStoriesRow.add("checkbox", undefined, "Bei ‚Alle Stories‘ kurze Stories überspringen; Mindestlänge:");
        fastMinCharsCheck.value = true;
        var fastMinCharsEdit = fastAllStoriesRow.add("edittext", undefined, "500");
        fastMinCharsEdit.characters = 7;
        fastAllStoriesRow.add("statictext", undefined, "Zeichen");
        var fastScopeInfo = fastScopePanel.add("statictext", undefined,
            "Tipp: Für ein 500-Seiten-Buch zuerst in den Haupttext klicken und ‚Aktuelle Story‘ wählen.",
            {multiline:true});
        fastScopeInfo.preferredSize.width = 740;

        var fastEnginePanel = fastSecA.add("panel", undefined, "Engine");
        fastEnginePanel.orientation = "column";
        fastEnginePanel.alignChildren = "left";
        fastEnginePanel.margins = 10;
        fastEnginePanel.spacing = 7;
        var fastEngineRow = fastEnginePanel.add("group");
        fastEngineRow.add("statictext", undefined, "Methode:");
        var fastEngineDD = fastEngineRow.add("dropdownlist", undefined, [
            "Direkt-GREP · maximale Einmal-Geschwindigkeit",
            "Live-GREP-Stil · bleibt bei späteren Textänderungen automatisch korrekt"
        ]);
        fastEngineDD.selection = 0;
        fastEngineDD.preferredSize.width = 560;
        var fastSpeedOptions = fastEnginePanel.add("group");
        var fastRedrawCheck = fastSpeedOptions.add("checkbox", undefined, "Bildschirm-Neuzeichnung während der Verarbeitung ausschalten");
        fastRedrawCheck.value = true;
        var fastRecomposeCheck = fastSpeedOptions.add("checkbox", undefined, "nur 1× am Ende neu umbrechen");
        fastRecomposeCheck.value = true;
        fastEnginePanel.add("statictext", undefined,
            "Direkt-GREP eignet sich für einmalige Komplettformatierung. Live-GREP-Stil erzeugt ein Absatzformat mit GREP-Stil für Hebräisch; neue/heute bearbeitete hebräische Passagen bleiben dadurch automatisch Keter YG.",
            {multiline:true}).preferredSize.width = 740;

        var fastTypoPanel = fastSecB.add("panel", undefined, "Basis-Typografie");
        fastTypoPanel.orientation = "column";
        fastTypoPanel.alignChildren = "left";
        fastTypoPanel.margins = 10;
        fastTypoPanel.spacing = 7;
        var fastFontRow = fastTypoPanel.add("group");
        fastFontRow.add("statictext", undefined, "Latein:");
        var fastLatinFontEdit = fastFontRow.add("edittext", undefined, "Cambria"); fastLatinFontEdit.characters = 20;
        fastFontRow.add("statictext", undefined, "Hebräisch:");
        var fastHebrewFontEdit = fastFontRow.add("edittext", undefined, "Keter YG"); fastHebrewFontEdit.characters = 20;

        var fastSizeRow = fastTypoPanel.add("group");
        fastSizeRow.add("statictext", undefined, "Basis:");
        var fastBaseSizeEdit = fastSizeRow.add("edittext", undefined, "9"); fastBaseSizeEdit.characters = 5;
        fastSizeRow.add("statictext", undefined, "pt   small:");
        var fastSmallSizeEdit = fastSizeRow.add("edittext", undefined, "8"); fastSmallSizeEdit.characters = 5;
        fastSizeRow.add("statictext", undefined, "pt   big:");
        var fastBigSizeEdit = fastSizeRow.add("edittext", undefined, "18"); fastBigSizeEdit.characters = 5;
        fastSizeRow.add("statictext", undefined, "pt");

        var fastParaRow = fastTypoPanel.add("group");
        fastParaRow.add("statictext", undefined, "Ausrichtung:");
        var fastAlignDD = fastParaRow.add("dropdownlist", undefined, [
            "Blocksatz · letzte Zeile links", "linksbündig", "zentriert", "rechtsbündig"
        ]);
        fastAlignDD.selection = 0;
        fastAlignDD.preferredSize.width = 260;
        var fastWorldReadyCheck = fastParaRow.add("checkbox", undefined, "Adobe World-Ready Composer");
        fastWorldReadyCheck.value = true;

        var fastModeRow = fastTypoPanel.add("group");
        var fastResetStylesCheck = fastModeRow.add("checkbox", undefined, "TXT-Neuformatierung: Schriftschnitte zuerst auf Regular/Medium normalisieren");
        fastResetStylesCheck.value = true;
        var fastClearOverridesCheck = fastTypoPanel.add("checkbox", undefined, "Live-GREP-Stil: lokale Overrides beim Anwenden löschen (für frisch importierte TXT empfohlen)");
        fastClearOverridesCheck.value = true;
        var fastCopyOldPresetBtn = fastTypoPanel.add("button", undefined, "Werte aus altem Typografie-Preset übernehmen");
        fastCopyOldPresetBtn.onClick = function () {
            fastBaseSizeEdit.text = baseSizeEdit.text;
            fastSmallSizeEdit.text = smallSizeEdit.text;
            fastBigSizeEdit.text = bigSizeEdit.text;
            fastAlignDD.selection = (alignDD.selection && alignDD.selection.index === 1) ? 2 : 0;
            fastHtmlCheck.value = tagsCheck.value;
        };

        var fastTagPanel = fastSecC.add("panel", undefined, "Native GREP-Durchläufe");
        fastTagPanel.orientation = "column";
        fastTagPanel.alignChildren = "left";
        fastTagPanel.margins = 10;
        fastTagPanel.spacing = 7;
        var fastHebrewCheck = fastTagPanel.add("checkbox", undefined, "Hebräische Unicode-Bereiche in einem GREP-Durchlauf auf Keter YG setzen");
        fastHebrewCheck.value = true;
        var fastHtmlCheck = fastTagPanel.add("checkbox", undefined, "HTML-Tags FAST verarbeiten: <br>, <small>, <big>, <b>, <i>, <sup>");
        fastHtmlCheck.value = true;
        var fastStripTagsCheck = fastTagPanel.add("checkbox", undefined, "verarbeitete HTML-Tags danach entfernen");
        fastStripTagsCheck.value = true;
        var fastNikkudCheck = fastTagPanel.add("checkbox", undefined, "optional Nikkud + Teamim per GREP entfernen");
        fastNikkudCheck.value = false;
        var fastDageshCheck = fastTagPanel.add("checkbox", undefined, "optional Dagesch U+05BC per GREP entfernen");
        fastDageshCheck.value = false;
        fastTagPanel.add("statictext", undefined,
            "FAST bedeutet hier: wenige native Find/Change-Aufrufe statt Millionen ExtendScript-Zugriffe. Fett/Kursiv werden nach der Schriftzuordnung gesetzt; <small>/<big> ändern die Größe; <sup> wird als echte InDesign-Hochstellung gesetzt.",
            {multiline:true}).preferredSize.width = 740;

        function refreshFastScopeInfoUI18() {
            try {
                if (app.documents.length === 0) { fastScopeInfo.text = "Kein Dokument geöffnet."; return; }
                var d = app.activeDocument, idx = fastScopeDD.selection ? fastScopeDD.selection.index : 1;
                var info = fastDescribeScope18(d, idx, fastMinCharsCheck.value ? parseInt(fastMinCharsEdit.text,10) : 0);
                fastScopeInfo.text = info;
            } catch (e) { fastScopeInfo.text = "Bereich konnte nicht geprüft werden: " + errText(e); }
        }
        fastScopeInfoBtn.onClick = refreshFastScopeInfoUI18;

        // -----------------------------------------------------------------
        // TAB 5: TXT import + book builder
        // -----------------------------------------------------------------
        var importTab = tabs.add("tab", undefined, "TXT importieren & Buchaufbau");
        var importSub  = makeSectionHost(importTab);
        var importSecA = makeSection(importSub, "TXT-Quelle & Ziel", 8);
        var importSecPreview = makeSection(importSub, "TXT-Aufteilung & Vorschau", 8);
        var importSecTypo = makeSection(importSub, "Import-Typografie", 8);
        var importSecFoot = makeSection(importSub, "Fußnoten", 8);
        var importSecPerf = makeSection(importSub, "Leistung · große Dateien", 8);
        var importSecB = makeSection(importSub, "Kopplung & Buchstruktur", 8);
        var importSecC = makeSection(importSub, "Seitennummerierung & Abschnittsziele", 8);
        var importSecD = makeSection(importSub, "Musterseiten & Zielrahmen", 8);
        var importSecE = makeSection(importSub, "Fallback-Raster & Rahmenfarben", 8);
        var importSecAI = makeSection(importSub, "OpenAI / KI-Werkzeuge", 8);

        var importIntro = importSecA.add("statictext", undefined,
            "TXT-Datei analysieren und Inhalte professionell auf vorhandene Muster-/Elternseiten-Rahmen verteilen. Titelseite, Vorspann und Haupttext können getrennte Seitennummerierungsabschnitte, Musterseiten und Rahmenfolgen verwenden; Titel und Vorspann besitzen zusätzlich den sauberen v2.2-Modus.",
            {multiline:true});
        importIntro.preferredSize.width = 680;

        var txtSrcPanel = importSecA.add("panel", undefined, "TXT-Quelle");
        txtSrcPanel.orientation = "column";
        txtSrcPanel.alignChildren = "fill";
        txtSrcPanel.margins = 10;
        var txtRow = txtSrcPanel.add("group");
        txtRow.add("statictext", undefined, "TXT-Datei:");
        var txtPathEdit = txtRow.add("edittext", undefined, ""); txtPathEdit.characters = 50;
        var txtBrowseBtn = txtRow.add("button", undefined, "Auswählen …");
        var txtAnalyzeBtn = txtRow.add("button", undefined, "Analysieren");
        var txtInfo = txtSrcPanel.add("statictext", undefined, "Noch keine TXT-Datei analysiert.", {multiline:true});
        txtInfo.preferredSize = [660, 70];
        var analyzedTxt = null;
        var analyzedTxtRaw = "";

        txtBrowseBtn.onClick = function () {
            var f = File.openDialog("TXT-Datei auswählen", "Text:*.txt");
            if (f) {
                txtPathEdit.text = f.fsName;
                analyzedTxt = null;
                analyzedTxtRaw = "";
                txtInfo.text = "Datei gewählt. Bitte analysieren.";
                try { txtPreviewList.removeAll(); } catch (_) {}
            }
        };
        txtAnalyzeBtn.onClick = function () {
            try {
                if (!txtPathEdit.text) throw new Error("Bitte zuerst eine TXT-Datei auswählen.");
                var f = new File(txtPathEdit.text);
                if (!f.exists) throw new Error("TXT-Datei nicht gefunden.");
                analyzedTxtRaw = readUTF8(f);
                analyzedTxt = analyzeBookTxt(analyzedTxtRaw);
                initializeTxtSplitUI18();
                refreshTxtPreviewUI18();
                try { refreshFootnoteAnalysisUI18(); } catch (_) {}
                try { refreshImportTypoProfileUI18(); } catch (_) {}
                txtInfo.text = bookTxtSummary(analyzedTxt) + "\nAufteilung: " + txtSplitModeLabel18();
                if (!newName.text || newName.text === "Neues_Dokument.indd") newName.text = sanitizeFileName(analyzedTxt.title || "Neues_Dokument") + ".indd";
            } catch (e) { alert("TXT-Analyse fehlgeschlagen:\n\n" + errText(e), SCRIPT_NAME); }
        };


        // -----------------------------------------------------------------
        // v2.6: explicit TXT split preview. Automatic detection is now only
        // a proposal; the user decides whether a frontmatter exists.
        // -----------------------------------------------------------------
        var txtSplitPanel = importSecPreview.add("panel", undefined, "Aufteilung der TXT-Datei");
        txtSplitPanel.orientation = "column";
        txtSplitPanel.alignChildren = "fill";
        txtSplitPanel.margins = 10;
        txtSplitPanel.spacing = 7;

        var txtSplitModeRow = txtSplitPanel.add("group");
        txtSplitModeRow.add("statictext", undefined, "Modus:");
        var txtSplitModeDD = txtSplitModeRow.add("dropdownlist", undefined, [
            "Nur Titelseite + kompletter Haupttext · kein Vorspann",
            "Manuell: Vorspann und Haupttext selbst abgrenzen",
            "Automatische Erkennung nur als Vorschlag"
        ]);
        txtSplitModeDD.selection = 0;
        txtSplitModeDD.preferredSize.width = 510;
        txtSplitModeRow.add("statictext", undefined, "Titelseiten-Metadaten:");
        var txtMetadataCountDD = txtSplitModeRow.add("dropdownlist", undefined, [
            "1 · nur Titel",
            "2 · Titel + zweiter Titel",
            "3 · + Quelle/Herausgeber",
            "4 · + URL/weitere Quelle"
        ]);
        txtMetadataCountDD.selection = 3;
        txtMetadataCountDD.preferredSize.width = 190;

        var txtSplitLinesRow = txtSplitPanel.add("group");
        txtSplitLinesRow.add("statictext", undefined, "Vorspann ab TXT-Zeile:");
        var txtFrontStartEdit = txtSplitLinesRow.add("edittext", undefined, "5");
        txtFrontStartEdit.characters = 7;
        txtSplitLinesRow.add("statictext", undefined, "Haupttext ab TXT-Zeile:");
        var txtBodyStartEdit = txtSplitLinesRow.add("edittext", undefined, "5");
        txtBodyStartEdit.characters = 7;
        var txtUseAutoBtn = txtSplitLinesRow.add("button", undefined, "Auto-Vorschlag übernehmen");

        var txtPreviewNav = txtSplitPanel.add("group");
        txtPreviewNav.add("statictext", undefined, "Vorschau ab Zeile:");
        var txtPreviewFromEdit = txtPreviewNav.add("edittext", undefined, "1");
        txtPreviewFromEdit.characters = 7;
        txtPreviewNav.add("statictext", undefined, "Zeilen:");
        var txtPreviewCountDD = txtPreviewNav.add("dropdownlist", undefined, ["30","60","120","250"]);
        txtPreviewCountDD.selection = 1;
        var txtPreviewRefreshBtn = txtPreviewNav.add("button", undefined, "Vorschau aktualisieren");
        var txtPreviewBodyBtn = txtPreviewNav.add("button", undefined, "Markierte Zeile = Haupttext");
        var txtPreviewFrontBtn = txtPreviewNav.add("button", undefined, "Markierte Zeile = Vorspann");

        var txtPreviewList = txtSplitPanel.add("listbox", undefined, [], {multiselect:false});
        txtPreviewList.preferredSize = [805, 245];
        var txtPreviewLineNumbers18 = [];

        var txtPreviewBottom = txtSplitPanel.add("group");
        var txtNoFrontBtn = txtPreviewBottom.add("button", undefined, "Kein Vorspann");
        var txtPreviewJumpBodyBtn = txtPreviewBottom.add("button", undefined, "Zum Haupttextbeginn");
        var txtPreviewJumpAutoBtn = txtPreviewBottom.add("button", undefined, "Zum Auto-Vorschlag");
        var txtSplitSummary = txtPreviewBottom.add("statictext", undefined, "Noch keine TXT-Datei analysiert.");
        txtSplitSummary.characters = 55;

        importSecPreview.add("statictext", undefined,
            "Sicherheitsprinzip: Die automatische Erkennung verschiebt keinen Text mehr ungefragt in den Vorspann. Im Modus „Nur Titelseite + Haupttext“ wird nach den Metadaten alles Haupttext. Im manuellen Modus bestimmst du die Trennzeilen selbst.",
            {multiline:true}).preferredSize.width = 790;

        function txtSplitModeLabel18() {
            var i = txtSplitModeDD.selection ? txtSplitModeDD.selection.index : 0;
            return i === 0 ? "Titel + Haupttext" : (i === 1 ? "manuell" : "Auto-Vorschlag");
        }

        function normalizedTxtLinesUI18() {
            var raw = String(analyzedTxtRaw || "").replace(/\r\n/g,"\n").replace(/\r/g,"\n");
            return raw.split("\n");
        }

        function txtMetadataCountUI18() {
            return (txtMetadataCountDD.selection ? txtMetadataCountDD.selection.index : 3) + 1;
        }

        function txtMetadataBoundsUI18() {
            var lines=normalizedTxtLinesUI18(), non=[],i,t,count=txtMetadataCountUI18();
            for(i=0;i<lines.length;i++){t=trim18(lines[i]);if(t)non.push({index:i,text:t});}
            if(!non.length)return {endLine:1,contentStartLine:1};
            if(count>non.length)count=non.length;
            var endIndex=non[Math.max(0,count-1)].index;
            var c=endIndex+1;
            while(c<lines.length && !trim18(lines[c]))c++;
            return {endLine:endIndex+1,contentStartLine:Math.min(lines.length,c+1)};
        }

        function txtAutoBodyLineUI18() {
            var lines=normalizedTxtLinesUI18(), b=txtMetadataBoundsUI18(), start=Math.max(0,b.contentStartLine-1),i,t;
            for(i=start;i<lines.length;i++){
                t=trim18(lines[i]);
                if(t.length>=180 || (t.length>=90 && /<(b|i|small)\b/i.test(t)))return i+1;
            }
            for(i=start;i<lines.length;i++){t=trim18(lines[i]);if(t.length>=100)return i+1;}
            return b.contentStartLine;
        }

        function parseTxtLineNoUI18(edit, fallback) {
            var n = parseInt(edit.text,10);
            if (isNaN(n) || n < 1) n = fallback || 1;
            return n;
        }

        function initializeTxtSplitUI18() {
            if (!analyzedTxt) return;
            var bounds=txtMetadataBoundsUI18();
            var content=bounds.contentStartLine;
            var autoBody=txtAutoBodyLineUI18();
            txtFrontStartEdit.text = String(content);
            txtBodyStartEdit.text = String(content); // safe default: no accidental frontmatter
            txtPreviewFromEdit.text = String(Math.max(1, content - 3));
            txtSplitModeDD.selection = 0;
            frontmatterCheck.value = false;
            txtSplitSummary.text = "Kein Vorspann · Haupttext ab Zeile " + content + " · Auto-Vorschlag: " + autoBody;
        }

        function applyTxtSplitModeUI18() {
            if (!analyzedTxt) return;
            var mode = txtSplitModeDD.selection ? txtSplitModeDD.selection.index : 0;
            var bounds=txtMetadataBoundsUI18();
            var content=bounds.contentStartLine;
            var autoBody=txtAutoBodyLineUI18();
            if (mode === 0) {
                txtFrontStartEdit.text = String(content);
                txtBodyStartEdit.text = String(content);
                frontmatterCheck.value = false;
            } else if (mode === 1) {
                if (parseTxtLineNoUI18(txtBodyStartEdit,content) <= content) {
                    txtBodyStartEdit.text = String(Math.max(content + 1, autoBody));
                }
                txtFrontStartEdit.text = String(content);
                frontmatterCheck.value = true;
            } else {
                txtFrontStartEdit.text = String(content);
                txtBodyStartEdit.text = String(autoBody);
                frontmatterCheck.value = autoBody > content;
            }
            refreshTxtPreviewUI18();
        }

        function selectedPreviewLineNoUI18() {
            if (!txtPreviewList.selection) return -1;
            var idx = txtPreviewList.selection.index;
            if (idx < 0 || idx >= txtPreviewLineNumbers18.length) return -1;
            return txtPreviewLineNumbers18[idx];
        }

        function txtPreviewMarker18(lineNo) {
            if (!analyzedTxt) return "";
            var bounds=txtMetadataBoundsUI18();
            var metaEnd=bounds.endLine;
            var autoBody=txtAutoBodyLineUI18();
            var mode = txtSplitModeDD.selection ? txtSplitModeDD.selection.index : 0;
            var frontStart = parseTxtLineNoUI18(txtFrontStartEdit, txtMetadataBoundsUI18().contentStartLine);
            var bodyStart = parseTxtLineNoUI18(txtBodyStartEdit, txtMetadataBoundsUI18().contentStartLine);
            if (lineNo <= metaEnd) return "[META]";
            if (lineNo === autoBody) return "[AUTO→BODY]";
            if (lineNo === bodyStart) return "[BODY→]";
            if (mode !== 0 && lineNo >= frontStart && lineNo < bodyStart) return "[VORSPANN]";
            if (lineNo >= bodyStart) return "[HAUPTTEXT]";
            return "";
        }

        function refreshTxtPreviewUI18() {
            if (!analyzedTxt || !analyzedTxtRaw) {
                txtSplitSummary.text = "Noch keine TXT-Datei analysiert.";
                return;
            }
            var lines = normalizedTxtLinesUI18();
            var from = parseTxtLineNoUI18(txtPreviewFromEdit,1);
            if (from > lines.length) from = Math.max(1, lines.length);
            var count = parseInt(txtPreviewCountDD.selection ? txtPreviewCountDD.selection.text : "60",10);
            if (isNaN(count) || count < 1) count = 60;
            var end = Math.min(lines.length, from + count - 1);
            var i, txt, marker, label;
            try { txtPreviewList.removeAll(); } catch (_) {
                try { while (txtPreviewList.items.length) txtPreviewList.remove(txtPreviewList.items[txtPreviewList.items.length-1]); } catch (__){}
            }
            txtPreviewLineNumbers18 = [];
            for (i = from; i <= end; i++) {
                txt = trim18(lines[i-1]);
                if (txt.length > 150) txt = txt.substr(0,150) + " …";
                marker = txtPreviewMarker18(i);
                label = ("000000" + i).slice(-6) + "  " + (marker ? marker + " " : "          ") + txt;
                txtPreviewList.add("item", label);
                txtPreviewLineNumbers18.push(i);
            }
            var mode = txtSplitModeDD.selection ? txtSplitModeDD.selection.index : 0;
            var b = parseTxtLineNoUI18(txtBodyStartEdit, txtMetadataBoundsUI18().contentStartLine);
            var fs = parseTxtLineNoUI18(txtFrontStartEdit, txtMetadataBoundsUI18().contentStartLine);
            txtSplitSummary.text = mode === 0
                ? ("Kein Vorspann · Haupttext ab Zeile " + b)
                : ("Vorspann " + fs + "–" + Math.max(fs,b-1) + " · Haupttext ab " + b);
        }

        function jumpTxtPreviewUI18(lineNo) {
            if (!analyzedTxt) return;
            txtPreviewFromEdit.text = String(Math.max(1, lineNo - 8));
            refreshTxtPreviewUI18();
        }

        function txtSplitConfigFromUI18() {
            if (!analyzedTxt) return {mode:"titleBody",metadataCount:4,frontStartLine:5,bodyStartLine:5};
            var idx = txtSplitModeDD.selection ? txtSplitModeDD.selection.index : 0;
            var content = txtMetadataBoundsUI18().contentStartLine;
            var metaCount=txtMetadataCountUI18();
            var frontStart = parseTxtLineNoUI18(txtFrontStartEdit,content);
            var bodyStart = parseTxtLineNoUI18(txtBodyStartEdit,content);
            if (bodyStart < content) bodyStart = content;
            if (frontStart < content) frontStart = content;
            if (idx === 0) {
                frontStart = content;
                if (bodyStart < content) bodyStart = content;
                return {mode:"titleBody",metadataCount:metaCount,frontStartLine:frontStart,bodyStartLine:bodyStart};
            }
            if (idx === 2) {
                return {mode:"auto",frontStartLine:content,bodyStartLine:txtAutoBodyLineUI18()};
            }
            if (bodyStart <= frontStart) throw new Error("Manuelle TXT-Aufteilung: Der Haupttext muss nach dem Vorspann beginnen.");
            return {mode:"manual",metadataCount:metaCount,frontStartLine:frontStart,bodyStartLine:bodyStart};
        }

        txtSplitModeDD.onChange = applyTxtSplitModeUI18;
        txtMetadataCountDD.onChange = function(){
            if(!analyzedTxt)return;
            applyTxtSplitModeUI18();
            txtPreviewFromEdit.text=String(Math.max(1,txtMetadataBoundsUI18().contentStartLine-3));
            refreshTxtPreviewUI18();
        };
        txtPreviewRefreshBtn.onClick = refreshTxtPreviewUI18;
        txtPreviewCountDD.onChange = refreshTxtPreviewUI18;
        txtFrontStartEdit.onChanging = function(){ try{refreshTxtPreviewUI18();}catch(_){} };
        txtBodyStartEdit.onChanging = function(){ try{refreshTxtPreviewUI18();}catch(_){} };
        txtPreviewBodyBtn.onClick = function(){
            var n=selectedPreviewLineNoUI18(); if(n<1)return;
            txtBodyStartEdit.text=String(n);
            if((txtSplitModeDD.selection?txtSplitModeDD.selection.index:0)===0) frontmatterCheck.value=false;
            refreshTxtPreviewUI18();
        };
        txtPreviewFrontBtn.onClick = function(){
            var n=selectedPreviewLineNoUI18(); if(n<1)return;
            txtSplitModeDD.selection=1; txtFrontStartEdit.text=String(n); frontmatterCheck.value=true;
            if(parseTxtLineNoUI18(txtBodyStartEdit,n+1)<=n)txtBodyStartEdit.text=String(n+1);
            refreshTxtPreviewUI18();
        };
        txtNoFrontBtn.onClick = function(){
            if(!analyzedTxt)return;
            txtSplitModeDD.selection=0;
            txtFrontStartEdit.text=String(analyzedTxt.contentStartLine||5);
            txtBodyStartEdit.text=String(analyzedTxt.contentStartLine||5);
            frontmatterCheck.value=false;
            refreshTxtPreviewUI18();
        };
        txtUseAutoBtn.onClick = function(){
            if(!analyzedTxt)return;
            txtSplitModeDD.selection=2;
            applyTxtSplitModeUI18();
            jumpTxtPreviewUI18(txtAutoBodyLineUI18());
        };
        txtPreviewJumpBodyBtn.onClick = function(){ if(analyzedTxt)jumpTxtPreviewUI18(parseTxtLineNoUI18(txtBodyStartEdit,analyzedTxt.contentStartLine||5)); };
        txtPreviewJumpAutoBtn.onClick = function(){ if(analyzedTxt)jumpTxtPreviewUI18(txtAutoBodyLineUI18()); };



        // -----------------------------------------------------------------
        // v2.11: Import typography directly inside TXT book building.
        // -----------------------------------------------------------------
        var importTypoPanel = importSecTypo.add("panel", undefined, "Haupttext schon beim Import formatieren");
        importTypoPanel.orientation = "column";
        importTypoPanel.alignChildren = "left";
        importTypoPanel.margins = 10;
        importTypoPanel.spacing = 7;

        var importTypoEnableCheck = importTypoPanel.add("checkbox", undefined,
            "Import-Typografie automatisch auf den Haupttext anwenden");
        importTypoEnableCheck.value = true;

        var importTypoPerfRow = importTypoPanel.add("group");
        importTypoPerfRow.add("statictext", undefined, "Texttyp / Engine:");
        var importTypoTextModeDD = importTypoPerfRow.add("dropdownlist", undefined, [
            "Auto erkennen · reines Hebräisch = TURBO (empfohlen)",
            "Hebräisch · komplette Story direkt Keter YG · kein Hebräisch-GREP",
            "Gemischt · Hebräisch + Latein per GREP",
            "Lateinisch · kein Hebräisch-GREP"
        ]);
        importTypoTextModeDD.selection = 0;
        importTypoTextModeDD.preferredSize.width = 485;
        var importTypoSkipAbsentHtmlCheck = importTypoPerfRow.add("checkbox", undefined, "nur vorhandene HTML-Tags scannen");
        importTypoSkipAbsentHtmlCheck.value = true;

        var importTypoProfileInfo = importTypoPanel.add("statictext", undefined,
            "TXT-Profil wird nach der Analyse angezeigt.", {multiline:true});
        importTypoProfileInfo.preferredSize.width = 790;

        var importTypoFontRow = importTypoPanel.add("group");
        importTypoFontRow.add("statictext", undefined, "Latein:");
        var importTypoLatinEdit = importTypoFontRow.add("edittext", undefined, "Cambria");
        importTypoLatinEdit.characters = 18;
        importTypoFontRow.add("statictext", undefined, "Hebräisch:");
        var importTypoHebrewEdit = importTypoFontRow.add("edittext", undefined, "Keter YG");
        importTypoHebrewEdit.characters = 18;
        importTypoFontRow.add("statictext", undefined, "Größe:");
        var importTypoBaseSizeEdit = importTypoFontRow.add("edittext", undefined, "9");
        importTypoBaseSizeEdit.characters = 5;
        importTypoFontRow.add("statictext", undefined, "pt");

        var importTypoLeadRow = importTypoPanel.add("group");
        importTypoLeadRow.add("statictext", undefined, "Zeilenabstand:");
        var importTypoLeadingModeDD = importTypoLeadRow.add("dropdownlist", undefined, [
            "Auto · Prozent der Schriftgröße",
            "Fest · Punktwert"
        ]);
        importTypoLeadingModeDD.selection = 0;
        importTypoLeadingModeDD.preferredSize.width = 230;
        var importTypoLeadingEdit = importTypoLeadRow.add("edittext", undefined, "120");
        importTypoLeadingEdit.characters = 6;
        var importTypoLeadingUnit = importTypoLeadRow.add("statictext", undefined, "%");
        importTypoLeadRow.add("statictext", undefined, "Ausrichtung:");
        var importTypoAlignDD = importTypoLeadRow.add("dropdownlist", undefined, [
            "Blocksatz · letzte Zeile links", "linksbündig", "zentriert", "rechtsbündig"
        ]);
        importTypoAlignDD.selection = 0;
        importTypoAlignDD.preferredSize.width = 240;

        var importTypoTagRow = importTypoPanel.add("group");
        var importTypoWorldReadyCheck = importTypoTagRow.add("checkbox", undefined, "Adobe World-Ready Composer");
        importTypoWorldReadyCheck.value = true;
        var importTypoHtmlCheck = importTypoTagRow.add("checkbox", undefined,
            "HTML-Tags: <small>, <big>, <b>, <i>, <sup>, <br>");
        importTypoHtmlCheck.value = true;
        var importTypoStripCheck = importTypoTagRow.add("checkbox", undefined, "Tags danach entfernen");
        importTypoStripCheck.value = true;

        var importTypoSizesRow = importTypoPanel.add("group");
        importTypoSizesRow.add("statictext", undefined, "small:");
        var importTypoSmallEdit = importTypoSizesRow.add("edittext", undefined, "8");
        importTypoSmallEdit.characters = 5;
        importTypoSizesRow.add("statictext", undefined, "pt   big:");
        var importTypoBigEdit = importTypoSizesRow.add("edittext", undefined, "18");
        importTypoBigEdit.characters = 5;
        importTypoSizesRow.add("statictext", undefined, "pt   ");
        importTypoSizesRow.add("statictext", undefined,
            "<sup> nutzt die Superscript-Einstellungen des InDesign-Dokuments.");

        var importTypoCopyRow = importTypoPanel.add("group");
        var importTypoFromFastBtn = importTypoCopyRow.add("button", undefined, "Aus Schnellformatierung übernehmen");
        var importTypoToFastBtn = importTypoCopyRow.add("button", undefined, "Nach Schnellformatierung kopieren");

        var importFootRatioPanel = importSecTypo.add("panel", undefined, "Fußnoten proportional zur Hauptschrift");
        importFootRatioPanel.orientation = "column";
        importFootRatioPanel.alignChildren = "left";
        importFootRatioPanel.margins = 10;
        importFootRatioPanel.spacing = 7;

        var importFootRatioRow = importFootRatioPanel.add("group");
        var importFootRelativeCheck = importFootRatioRow.add("checkbox", undefined,
            "Fußnotengröße automatisch aus der Hauptschrift berechnen");
        importFootRelativeCheck.value = true;
        importFootRatioRow.add("statictext", undefined, "Größe:");
        var importFootPercentEdit = importFootRatioRow.add("edittext", undefined, "80");
        importFootPercentEdit.characters = 5;
        importFootRatioRow.add("statictext", undefined, "%   Zeilenabstand:");
        var importFootLeadingPercentEdit = importFootRatioRow.add("edittext", undefined, "120");
        importFootLeadingPercentEdit.characters = 5;
        importFootRatioRow.add("statictext", undefined, "% der Fußnotengröße");
        var importFootPreview = importFootRatioRow.add("statictext", undefined, "");
        importFootPreview.characters = 24;

        importFootRatioPanel.add("statictext", undefined,
            "Beispiel: Haupttext 10 pt + Fußnote 80 % = 8 pt. Die Fußnote bleibt eine native InDesign-Fußnote; nur ihr Absatzformat wird proportional eingestellt.",
            {multiline:true}).preferredSize.width = 790;

        function importTypoAlignment18(){
            var i=importTypoAlignDD.selection?importTypoAlignDD.selection.index:0;
            return i===1?"left":(i===2?"center":(i===3?"right":"justify"));
        }

        function importTypoLeadingUI18(){
            var v=parseFloat(importTypoLeadingEdit.text);
            if(importTypoLeadingModeDD.selection&&importTypoLeadingModeDD.selection.index===1){
                if(isNaN(v)||v<=0)v=11;
                return {mode:"fixed",value:v,autoPercent:null};
            }
            if(isNaN(v)||v<=0)v=120;
            return {mode:"auto",value:null,autoPercent:v};
        }

        function updateImportTypoLeadingUnit18(){
            importTypoLeadingUnit.text=(importTypoLeadingModeDD.selection&&importTypoLeadingModeDD.selection.index===1)?"pt":"%";
        }
        importTypoLeadingModeDD.onChange=updateImportTypoLeadingUnit18;

        function updateImportFootPreview18(){
            var body=parseFloat(importTypoBaseSizeEdit.text);if(isNaN(body)||body<=0)body=9;
            var pct=parseFloat(importFootPercentEdit.text);if(isNaN(pct)||pct<=0)pct=80;
            var lp=parseFloat(importFootLeadingPercentEdit.text);if(isNaN(lp)||lp<=0)lp=120;
            var fs=Math.round(body*pct)/100;
            fs=Math.round(fs*100)/100;
            var ld=Math.round(fs*lp)/100;
            ld=Math.round(ld*100)/100;
            importFootPreview.text="→ "+fs+" pt / "+ld+" pt";
            try{
                if(importFootRelativeCheck.value && typeof footSizeEdit!=="undefined" && footSizeEdit){
                    footSizeEdit.text=String(fs);
                    footLeadingEdit.text=String(ld);
                }
            }catch(_){}
            return {size:fs,leading:ld};
        }
        importTypoBaseSizeEdit.onChanging=updateImportFootPreview18;
        importFootPercentEdit.onChanging=updateImportFootPreview18;
        importFootLeadingPercentEdit.onChanging=updateImportFootPreview18;
        updateImportFootPreview18();

        importTypoFromFastBtn.onClick=function(){
            importTypoLatinEdit.text=fastLatinFontEdit.text;
            importTypoHebrewEdit.text=fastHebrewFontEdit.text;
            importTypoBaseSizeEdit.text=fastBaseSizeEdit.text;
            importTypoSmallEdit.text=fastSmallSizeEdit.text;
            importTypoBigEdit.text=fastBigSizeEdit.text;
            importTypoAlignDD.selection=fastAlignDD.selection?fastAlignDD.selection.index:0;
            importTypoWorldReadyCheck.value=fastWorldReadyCheck.value;
            importTypoHtmlCheck.value=fastHtmlCheck.value;
            importTypoStripCheck.value=fastStripTagsCheck.value;
            updateImportFootPreview18();
        };
        importTypoToFastBtn.onClick=function(){
            fastLatinFontEdit.text=importTypoLatinEdit.text;
            fastHebrewFontEdit.text=importTypoHebrewEdit.text;
            fastBaseSizeEdit.text=importTypoBaseSizeEdit.text;
            fastSmallSizeEdit.text=importTypoSmallEdit.text;
            fastBigSizeEdit.text=importTypoBigEdit.text;
            fastAlignDD.selection=importTypoAlignDD.selection?importTypoAlignDD.selection.index:0;
            fastWorldReadyCheck.value=importTypoWorldReadyCheck.value;
            fastHtmlCheck.value=importTypoHtmlCheck.value;
            fastStripTagsCheck.value=importTypoStripCheck.value;
        };

        function importTypoModeFromUI18(){
            var i=importTypoTextModeDD.selection?importTypoTextModeDD.selection.index:0;
            return i===1?"hebrew":(i===2?"mixed":(i===3?"latin":"auto"));
        }

        function refreshImportTypoProfileUI18(){
            if(!analyzedTxt){
                importTypoProfileInfo.text="TXT-Profil wird nach der Analyse angezeigt.";
                return;
            }
            var p=analyzeImportTextProfile18(String(analyzedTxt.body||""),importTypoModeFromUI18());
            importTypoProfileInfo.text="Erkannt: "+importTextProfileLabel18(p)+
                " · Stichprobe HE "+Math.round(p.hebrewRatio*1000)/10+"%"+
                " · HTML: "+(p.html.any?p.html.summary:"keine relevanten Tags")+
                " · erwartete Basis-Pässe: "+estimatedImportTypographyPasses18(p,!!importTypoHtmlCheck.value);
        }
        importTypoTextModeDD.onChange=function(){try{refreshImportTypoProfileUI18();}catch(_){}};

        function collectImportTypographyUI18(){
            var base=parseFloat(importTypoBaseSizeEdit.text);if(isNaN(base)||base<=0)base=9;
            var small=parseFloat(importTypoSmallEdit.text);if(isNaN(small)||small<=0)small=8;
            var big=parseFloat(importTypoBigEdit.text);if(isNaN(big)||big<=0)big=18;
            var lead=importTypoLeadingUI18();
            var fp=updateImportFootPreview18();
            return {
                enabled:!!importTypoEnableCheck.value,
                latinFontFamily:trim18(importTypoLatinEdit.text)||"Cambria",
                hebrewFontFamily:trim18(importTypoHebrewEdit.text)||"Keter YG",
                baseSize:base,smallSize:small,bigSize:big,
                alignment:importTypoAlignment18(),
                worldReady:!!importTypoWorldReadyCheck.value,
                processHtml:!!importTypoHtmlCheck.value,
                stripTags:!!importTypoStripCheck.value,
                textMode:importTypoModeFromUI18(),
                skipAbsentHtml:!!importTypoSkipAbsentHtmlCheck.value,
                leadingMode:lead.mode,leadingValue:lead.value,autoLeadingPercent:lead.autoPercent,
                footnoteRelative:!!importFootRelativeCheck.value,
                footnotePercent:parseFloat(importFootPercentEdit.text)||80,
                footnoteLeadingPercent:parseFloat(importFootLeadingPercentEdit.text)||120,
                computedFootnoteSize:fp.size,computedFootnoteLeading:fp.leading
            };
        }

        // -----------------------------------------------------------------
        // v2.7: Native footnote import.
        // The TXT source may contain nested <i> tags inside a footnote, so a
        // dedicated parser is used instead of a single GREP expression.
        // -----------------------------------------------------------------
        var footPanel = importSecFoot.add("panel", undefined, "TXT-Fußnoten → echte InDesign-Fußnoten");
        footPanel.orientation = "column";
        footPanel.alignChildren = "fill";
        footPanel.margins = 10;
        footPanel.spacing = 7;

        var footTopRow = footPanel.add("group");
        var footEnableCheck = footTopRow.add("checkbox", undefined, "Fußnoten automatisch erkennen und als native InDesign-Fußnoten erzeugen");
        footEnableCheck.value = true;
        var footAnalyzeBtn = footTopRow.add("button", undefined, "TXT-Fußnoten analysieren");
        var footAnalysisInfo = footTopRow.add("statictext", undefined, "Noch nicht analysiert.");
        footAnalysisInfo.characters = 46;

        var footDetectRow = footPanel.add("group");
        var footTolerantCheck = footDetectRow.add("checkbox", undefined, "Tolerant: auch <sup>…</sup><i class=\"footnote\">…</i> ohne marker-class erkennen");
        footTolerantCheck.value = true;
        var footPreserveOrphansCheck = footDetectRow.add("checkbox", undefined, "Verwaiste Quellmarker als hochgestellten Text erhalten");
        footPreserveOrphansCheck.value = true;
        var footStoreMarkerCheck = footDetectRow.add("checkbox", undefined, "Quellmarker intern am Footnote-Objekt speichern");
        footStoreMarkerCheck.value = true;

        var footNumberPanel = importSecFoot.add("panel", undefined, "InDesign-Fußnotennummerierung");
        footNumberPanel.orientation = "column";
        footNumberPanel.alignChildren = "left";
        footNumberPanel.margins = 10;
        footNumberPanel.spacing = 7;

        var footNumberRow = footNumberPanel.add("group");
        footNumberRow.add("statictext", undefined, "Format:");
        var footNumberStyleDD = footNumberRow.add("dropdownlist", undefined, [
            "Arabisch · 1, 2, 3",
            "Römisch klein · i, ii, iii",
            "Römisch groß · I, II, III",
            "Buchstaben klein · a, b, c",
            "Buchstaben groß · A, B, C",
            "Symbole",
            "Sternchen"
        ]);
        footNumberStyleDD.selection = 0;
        footNumberRow.add("statictext", undefined, "Beginnen bei:");
        var footStartAtEdit = footNumberRow.add("edittext", undefined, "1");
        footStartAtEdit.characters = 5;
        footNumberRow.add("statictext", undefined, "Neu beginnen:");
        var footRestartDD = footNumberRow.add("dropdownlist", undefined, [
            "nicht neu beginnen · fortlaufend",
            "auf jeder Seite",
            "auf jedem Druckbogen",
            "in jedem InDesign-Abschnitt"
        ]);
        footRestartDD.selection = 0;
        footRestartDD.preferredSize.width = 235;

        var footNumberNote = footNumberPanel.add("statictext", undefined,
            "Wichtig: Die Quellnummern dienen zur Erkennung und Kontrolle. Native InDesign-Fußnoten werden nach den hier gewählten Dokumentoptionen automatisch neu nummeriert. InDesign kann nativ fortlaufend bzw. pro Seite, Druckbogen oder Abschnitt neu beginnen – nicht an beliebigen Chapter-Überschriften.",
            {multiline:true});
        footNumberNote.preferredSize.width = 790;

        var footFormatPanel = importSecFoot.add("panel", undefined, "Fußnotentext & Layout");
        footFormatPanel.orientation = "column";
        footFormatPanel.alignChildren = "left";
        footFormatPanel.margins = 10;
        footFormatPanel.spacing = 7;

        var footFmtRow = footFormatPanel.add("group");
        footFmtRow.add("statictext", undefined, "Schrift:");
        var footFontEdit = footFmtRow.add("edittext", undefined, "Cambria");
        footFontEdit.characters = 18;
        footFmtRow.add("statictext", undefined, "Größe:");
        var footSizeEdit = footFmtRow.add("edittext", undefined, "8");
        footSizeEdit.characters = 5;
        footFmtRow.add("statictext", undefined, "pt   Zeilenabstand:");
        var footLeadingEdit = footFmtRow.add("edittext", undefined, "9.5");
        footLeadingEdit.characters = 5;
        footFmtRow.add("statictext", undefined, "pt   Trennung:");
        var footSeparatorDD = footFmtRow.add("dropdownlist", undefined, ["Tabulator", "Leerzeichen", "Geviert-Leerraum"]);
        footSeparatorDD.selection = 0;

        var footLayoutRow = footFormatPanel.add("group");
        var footItalicCheck = footLayoutRow.add("checkbox", undefined, "Kursive <i>…</i>-Auszeichnungen innerhalb der Fußnote erhalten");
        footItalicCheck.value = true;
        var footAllowSplitCheck = footLayoutRow.add("checkbox", undefined, "lange Fußnoten dürfen über Spalten/Rahmen umbrechen");
        footAllowSplitCheck.value = true;
        var footSpanColumnsCheck = footLayoutRow.add("checkbox", undefined, "Fußnoten in mehrspaltigen Textrahmen spaltenübergreifend");
        footSpanColumnsCheck.value = false;

        var footStyleNote = footFormatPanel.add("statictext", undefined,
            "Das Skript erzeugt „BB · Fußnote“, „BB · Fußnotenverweis“ und „BB · Fußnote Kursiv“. <br> innerhalb einer Fußnote wird zu einem echten Absatz. Die eigentliche Seitenplatzierung übernimmt danach InDesign automatisch am unteren Spalten-/Rahmenende.",
            {multiline:true});
        footStyleNote.preferredSize.width = 790;

        function refreshFootnoteAnalysisUI18() {
            try {
                if(!analyzedTxtRaw && txtPathEdit.text) {
                    var ff=new File(txtPathEdit.text);
                    if(ff.exists) analyzedTxtRaw=readUTF8(ff);
                }
                if(!analyzedTxtRaw) { footAnalysisInfo.text="Keine TXT-Datei geladen."; return; }
                var st=analyzeFootnoteMarkup18(analyzedTxtRaw,footTolerantCheck.value);
                footAnalysisInfo.text=st.validNotes+" Fußnoten · "+st.orphanMarkers+" verwaiste Marker · "+st.nonNumericMarkers+" Sondermarker";
            } catch(e) {
                footAnalysisInfo.text="Analyse fehlgeschlagen";
                alert("Fußnoten-Analyse fehlgeschlagen:\n\n"+errText(e),SCRIPT_NAME);
            }
        }
        footAnalyzeBtn.onClick=refreshFootnoteAnalysisUI18;
        footTolerantCheck.onClick=function(){ try{refreshFootnoteAnalysisUI18();}catch(_){} };

        function collectFootnoteOptionsUI18() {
            var sz=parseFloat(footSizeEdit.text); if(isNaN(sz)||sz<=0)sz=8;
            var ld=parseFloat(footLeadingEdit.text); if(isNaN(ld)||ld<=0)ld=9.5;
            var start=parseInt(footStartAtEdit.text,10); if(isNaN(start)||start<1)start=1;
            return {
                enabled:!!footEnableCheck.value,
                tolerant:!!footTolerantCheck.value,
                preserveOrphans:!!footPreserveOrphansCheck.value,
                storeSourceMarker:!!footStoreMarkerCheck.value,
                numberingStyle:footNumberStyleDD.selection?footNumberStyleDD.selection.index:0,
                restart:footRestartDD.selection?footRestartDD.selection.index:0,
                startAt:start,
                fontFamily:trim18(footFontEdit.text)||"Cambria",
                pointSize:sz,
                leading:ld,
                separator:footSeparatorDD.selection?footSeparatorDD.selection.index:0,
                preserveItalic:!!footItalicCheck.value,
                allowSplit:!!footAllowSplitCheck.value,
                spanColumns:!!footSpanColumnsCheck.value
            };
        }
        try{updateImportFootPreview18();}catch(_){}


        // -----------------------------------------------------------------
        // v2.8: TURBO import for large books.
        // The old v2.7 path remains available as compatibility mode.
        // -----------------------------------------------------------------
        var perfPanel = importSecPerf.add("panel", undefined, "Import-Engine");
        perfPanel.orientation = "column";
        perfPanel.alignChildren = "left";
        perfPanel.margins = 10;
        perfPanel.spacing = 8;

        var perfModeRow = perfPanel.add("group");
        perfModeRow.add("statictext", undefined, "Methode:");
        var largeImportModeDD = perfModeRow.add("dropdownlist", undefined, [
            "Auto · TURBO bei großen Dateien / vielen Fußnoten (empfohlen)",
            "TURBO · immer verwenden",
            "Kompatibel · alte v2.7-Importlogik"
        ]);
        largeImportModeDD.selection = 0;
        largeImportModeDD.preferredSize.width = 500;

        var perfAutoRow = perfPanel.add("group");
        perfAutoRow.add("statictext", undefined, "Auto ab:");
        var turboThresholdCharsEdit = perfAutoRow.add("edittext", undefined, "250000");
        turboThresholdCharsEdit.characters = 9;
        perfAutoRow.add("statictext", undefined, "Zeichen oder");
        var turboThresholdNotesEdit = perfAutoRow.add("edittext", undefined, "100");
        turboThresholdNotesEdit.characters = 6;
        perfAutoRow.add("statictext", undefined, "Fußnoten");

        var perfEstimateRow = perfPanel.add("group");
        var turboEstimateBtn = perfEstimateRow.add("button", undefined, "TURBO-Schätzung für aktuelle TXT");
        var turboEstimateInfo = perfEstimateRow.add("statictext", undefined, "Noch nicht berechnet.");
        turboEstimateInfo.characters = 70;

        var perfPrepPanel = importSecPerf.add("panel", undefined, "Vorbereitung statt Seite-für-Seite-Recompose");
        perfPrepPanel.orientation = "column";
        perfPrepPanel.alignChildren = "left";
        perfPrepPanel.margins = 10;
        perfPrepPanel.spacing = 7;

        var prepRow = perfPrepPanel.add("group");
        var turboPreallocateCheck = prepRow.add("checkbox", undefined, "Seiten/Rahmen vor dem Textimport in einem Rutsch vorbereiten");
        turboPreallocateCheck.value = true;
        prepRow.add("statictext", undefined, "Schätzung:");
        var turboCharsPerPageEdit = prepRow.add("edittext", undefined, "2200");
        turboCharsPerPageEdit.characters = 7;
        prepRow.add("statictext", undefined, "effektive Zeichen/Seite");
        prepRow.add("statictext", undefined, "Reserve:");
        var turboReserveEdit = prepRow.add("edittext", undefined, "25");
        turboReserveEdit.characters = 4;
        prepRow.add("statictext", undefined, "%");

        var calibRow = perfPrepPanel.add("group");
        var turboCalibrateTypographyCheck = calibRow.add("checkbox", undefined,
            "Bei Import-Typografie zuerst klein kalibrieren, dann Seitenzahl aus realem Satz berechnen");
        turboCalibrateTypographyCheck.value = true;
        calibRow.add("statictext", undefined, "Kalibrierseiten:");
        var turboCalibrationPagesEdit = calibRow.add("edittext", undefined, "12");
        turboCalibrationPagesEdit.characters = 4;
        calibRow.add("statictext", undefined, "Reserve nach Messung:");
        var turboCalibrationReserveEdit = calibRow.add("edittext", undefined, "8");
        turboCalibrationReserveEdit.characters = 4;
        calibRow.add("statictext", undefined, "%");

        var pageLiveRow = perfPrepPanel.add("group");
        var turboPagePanelPulseCheck = pageLiveRow.add("checkbox", undefined,
            "Pages-Panel während sehr großer Imports gelegentlich aktualisieren");
        turboPagePanelPulseCheck.value = true;
        pageLiveRow.add("statictext", undefined, "alle");
        var turboPagePanelPulseEveryEdit = pageLiveRow.add("edittext", undefined, "200");
        turboPagePanelPulseEveryEdit.characters = 5;
        pageLiveRow.add("statictext", undefined, "neu angelegten Seiten");

        var batchRow = perfPrepPanel.add("group");
        batchRow.add("statictext", undefined, "Seitenblock:");
        var turboPageBatchEdit = batchRow.add("edittext", undefined, "20");
        turboPageBatchEdit.characters = 5;
        batchRow.add("statictext", undefined, "Seiten   Text-Chunk:");
        var turboChunkCharsEdit = batchRow.add("edittext", undefined, "120000");
        turboChunkCharsEdit.characters = 9;
        batchRow.add("statictext", undefined, "Zeichen");
        var turboTrimReserveCheck = batchRow.add("checkbox", undefined, "unbenutzte Reserveseiten entfernen (bei BULK-RTF aus Sicherheitsgründen standardmäßig aus)");
        turboTrimReserveCheck.value = false;

        var perfFootPanel = importSecPerf.add("panel", undefined, "Fußnoten & Umbruch");
        perfFootPanel.orientation = "column";
        perfFootPanel.alignChildren = "left";
        perfFootPanel.margins = 10;
        perfFootPanel.spacing = 7;

        var bulkFootRow = perfFootPanel.add("group");
        bulkFootRow.add("statictext", undefined, "Fußnoten-Engine:");
        var bulkFootEngineDD = bulkFootRow.add("dropdownlist", undefined, [
            "Auto · BULK-RTF ab vielen Fußnoten (empfohlen)",
            "BULK-RTF · immer · ein einziger InDesign-Import",
            "Native Footnotes.add() · v2.8 TURBO"
        ]);
        bulkFootEngineDD.selection = 0;
        bulkFootEngineDD.preferredSize.width = 470;
        bulkFootRow.add("statictext", undefined, "BULK ab:");
        var bulkFootThresholdEdit = bulkFootRow.add("edittext", undefined, "50");
        bulkFootThresholdEdit.characters = 6;
        bulkFootRow.add("statictext", undefined, "Fußnoten");

        var bulkFootFallbackCheck = perfFootPanel.add("checkbox", undefined,
            "Wenn der RTF-Importfilter scheitert, automatisch auf v2.8 Footnotes.add() zurückfallen");
        bulkFootFallbackCheck.value = true;

        var turboDeferredFootnotesCheck = perfFootPanel.add("checkbox", undefined,
            "Native-add()-Fallback: Fußnoten erst erzeugen, nachdem Haupttext und Seitenrahmen stehen");
        turboDeferredFootnotesCheck.value = true;
        turboDeferredFootnotesCheck.enabled = false;
        var turboRedrawCheck = perfFootPanel.add("checkbox", undefined,
            "InDesign-Dokument-Neuzeichnung während TURBO-Import ausschalten");
        turboRedrawCheck.value = true;

        var bulkFootNote = perfFootPanel.add("statictext", undefined,
            "BULK-RTF erzeugt außerhalb des Layouts eine temporäre RTF-Datei mit echten RTF-Fußnoten und platziert sie nur einmal in die bereits verkettete Story. Dadurch entfallen bei Kehot 3.460 einzelne Footnotes.add()-Operationen.",
            {multiline:true});
        bulkFootNote.preferredSize.width = 790;

        importSecPerf.add("statictext", undefined,
            "Warum das schneller ist: v2.7/v2.8 mussten bei vielen Fußnoten tausende Footnotes.add()-DOM-Aufrufe ausführen. v2.9 kann stattdessen alle Fußnoten in einer temporären RTF-Datei kodieren und InDesigns eigenen Word/RTF-Importfilter einmal aufrufen. Seitenrahmen werden weiterhin blockweise vorbereitet und Restseiten blockweise ergänzt.",
            {multiline:true}).preferredSize.width = 800;

        var repairPanel = importSecPerf.add("panel", undefined, "Bereits importierten Übersatz automatisch fertigstellen");
        repairPanel.orientation = "column";
        repairPanel.alignChildren = "left";
        repairPanel.margins = 10;
        repairPanel.spacing = 7;

        var repairRow = repairPanel.add("group");
        repairRow.add("statictext", undefined, "Zusatzseiten pro Durchlauf:");
        var repairBatchEdit = repairRow.add("edittext", undefined, "5");
        repairBatchEdit.characters = 5;
        var repairOversetBtn = repairRow.add("button", undefined, "Übersatz-Story jetzt fortsetzen");
        var repairStatus = repairRow.add("statictext", undefined, "Verwendet die aktuell gewählte Haupttext-Musterseite/Rahmenfolge.");
        repairStatus.characters = 56;

        repairPanel.add("statictext", undefined,
            "Für bereits importierte Bücher: Das Skript sucht die größte Story mit Übersatz, nimmt deren letzten verketteten Textrahmen und hängt weitere Seiten mit der aktuell im Unterreiter „Musterseiten & Zielrahmen“ gewählten Haupttext-Route an. Es stoppt erst, wenn die Story selbst keinen Übersatz mehr meldet.",
            {multiline:true}).preferredSize.width = 790;

        repairOversetBtn.onClick = function(){
            var pr=null,oldRedraw=null,redrawChanged=false;
            try{
                if(app.documents.length===0)throw new Error("Kein InDesign-Dokument geöffnet.");
                var d=app.activeDocument;
                if(!masterCatalogUI.length)refreshMasterCatalogUI18();
                var route=routeConfigFromUI18(bodyRouteUI);
                validateMasterRoute18(route,"Haupttext");
                var story=findLargestOversetStory18(d);
                if(!story){
                    repairStatus.text="Kein Übersatz gefunden.";
                    alert("Im aktiven Dokument wurde keine überlaufende Story gefunden.",SCRIPT_NAME);
                    return;
                }
                var batch=parseInt(repairBatchEdit.text,10);if(isNaN(batch)||batch<1)batch=5;if(batch>50)batch=50;
                var repairOpt={
                    masterAutoApply:autoApplyMasterCheck.value,
                    masterClearText:true,
                    preserveMasterVisual:true,
                    frameColors:false,frameHex:[],frameInsetMm:0,frameStrokePt:0,frameStrokeHex:""
                };
                try{oldRedraw=app.scriptPreferences.enableRedraw;app.scriptPreferences.enableRedraw=false;redrawChanged=true;}catch(_){}
                pr=createProgress();pr.show();
                setProgress(pr,3,"Übersatz-Story analysieren …");
                var rr=continueOversetStoryMaster18(d,story,route,repairOpt,batch,pr,null);
                setProgress(pr,100,"Fertig · Story vollständig");
                try{pr.close();}catch(_){}
                pr=null;
                repairStatus.text=rr.added+" Seiten ergänzt · Übersatz: "+(rr.overflows?"JA":"NEIN");
                alert("Übersatz-Reparatur abgeschlossen.\n\nZusätzliche Seiten: "+rr.added+
                    "\nStory-Übersatz danach: "+(rr.overflows?"JA":"NEIN")+
                    "\nLetzte Seite: "+rr.lastPageName,SCRIPT_NAME);
            }catch(e){
                try{if(pr)pr.close();}catch(_){}
                alert("Übersatz konnte nicht fortgesetzt werden:\n\n"+errText(e),SCRIPT_NAME);
            }finally{
                if(redrawChanged){try{app.scriptPreferences.enableRedraw=oldRedraw;}catch(_){}}
            }
        };

        turboEstimateBtn.onClick = function(){
            try{
                if(!txtPathEdit.text)throw new Error("Bitte zuerst eine TXT-Datei auswählen.");
                var ff=new File(txtPathEdit.text);if(!ff.exists)throw new Error("TXT-Datei nicht gefunden.");
                var rawNow=analyzedTxtRaw||readUTF8(ff);
                var baseNow=analyzedTxt||analyzeBookTxt(rawNow);
                var splitNow=txtSplitConfigFromUI18();
                var aNow=applyTxtSplitConfig18(baseNow,rawNow,splitNow);
                var fcfg=collectFootnoteOptionsUI18(),plan=null,bodyForEstimate=aNow.body;
                if(fcfg.enabled){
                    plan=parseFootnoteMarkup18(bodyForEstimate,fcfg);
                    bodyForEstimate=plan.text;
                }
                var perfNow=collectLargeImportOptionsUI18();
                var effective=String(bodyForEstimate||"").length+turboFootnoteChars18(plan);
                var pages=turboEstimatedPages18(bodyForEstimate,plan,perfNow);
                var use=shouldUseTurboImport18(bodyForEstimate,plan,perfNow);
                turboEstimateInfo.text=(effective/1000000).toFixed(2)+" Mio. effektive Zeichen · "+
                    (plan?plan.notes.length:0)+" Fußnoten · ca. "+pages+" Seiten · "+(use?"TURBO":"Kompatibel");
            }catch(e){
                turboEstimateInfo.text="Schätzung fehlgeschlagen.";
                alert("TURBO-Schätzung fehlgeschlagen:\n\n"+errText(e),SCRIPT_NAME);
            }
        };

        function collectLargeImportOptionsUI18() {
            var mode=largeImportModeDD.selection?largeImportModeDD.selection.index:0;
            var tc=parseInt(turboThresholdCharsEdit.text,10); if(isNaN(tc)||tc<10000)tc=250000;
            var tn=parseInt(turboThresholdNotesEdit.text,10); if(isNaN(tn)||tn<1)tn=100;
            var cpp=parseInt(turboCharsPerPageEdit.text,10); if(isNaN(cpp)||cpp<500)cpp=2200;
            var reserve=parseFloat(turboReserveEdit.text); if(isNaN(reserve)||reserve<0)reserve=25; if(reserve>100)reserve=100;
            var batch=parseInt(turboPageBatchEdit.text,10); if(isNaN(batch)||batch<5)batch=20; if(batch>250)batch=250;
            var chunk=parseInt(turboChunkCharsEdit.text,10); if(isNaN(chunk)||chunk<20000)chunk=120000; if(chunk>500000)chunk=500000;
            var bulkThreshold=parseInt(bulkFootThresholdEdit.text,10); if(isNaN(bulkThreshold)||bulkThreshold<1)bulkThreshold=50;
            var calPages=parseInt(turboCalibrationPagesEdit.text,10); if(isNaN(calPages)||calPages<4)calPages=12; if(calPages>50)calPages=50;
            var calReserve=parseFloat(turboCalibrationReserveEdit.text); if(isNaN(calReserve)||calReserve<0)calReserve=8; if(calReserve>50)calReserve=50;
            var pulseEvery=parseInt(turboPagePanelPulseEveryEdit.text,10); if(isNaN(pulseEvery)||pulseEvery<50)pulseEvery=200;
            return {
                mode:mode,
                thresholdChars:tc,
                thresholdNotes:tn,
                preallocate:!!turboPreallocateCheck.value,
                charsPerPage:cpp,
                reservePercent:reserve,
                pageBatch:batch,
                chunkChars:chunk,
                trimReserve:!!turboTrimReserveCheck.value,
                deferredFootnotes:true,
                bulkFootnoteEngine:bulkFootEngineDD.selection?bulkFootEngineDD.selection.index:0,
                bulkFootnoteThreshold:bulkThreshold,
                bulkFootnoteFallback:!!bulkFootFallbackCheck.value,
                calibrateTypographyFirst:!!turboCalibrateTypographyCheck.value,
                calibrationPages:calPages,
                calibrationReservePercent:calReserve,
                pulsePagePanel:!!turboPagePanelPulseCheck.value,
                pulseEveryPages:pulseEvery,
                disableRedraw:!!turboRedrawCheck.value
            };
        }

        var couplingPanel = importSecB.add("panel", undefined, "Kopplung mit anderen Reitern");
        couplingPanel.orientation = "column";
        couplingPanel.alignChildren = "left";
        couplingPanel.margins = 10;
        var linkCreateCheck = couplingPanel.add("checkbox", undefined, "Mit Reiter 2 koppeln: zuerst neues Dokument nach dessen Einstellungen anlegen");
        linkCreateCheck.value = true;
        var linkToolsCheck = couplingPanel.add("checkbox", undefined, "Mit Reiter 3 koppeln: alte Typografie-/Tag-Engine verwenden");
        linkToolsCheck.value = false;
        var linkFastCheck = couplingPanel.add("checkbox", undefined, "Mit Schnellformatierung koppeln: neue FAST-Engine auf den importierten Haupttext anwenden (empfohlen)");
        linkFastCheck.value = false;
        linkToolsCheck.onClick = function(){ if(linkToolsCheck.value) linkFastCheck.value=false; };
        linkFastCheck.onClick = function(){ if(linkFastCheck.value) linkToolsCheck.value=false; };
        var largeToolsCheck = couplingPanel.add("checkbox", undefined, "Alte Reiter-3-Engine auch bei sehr großen Haupttexten (> 500.000 Zeichen) ausführen");
        largeToolsCheck.value = false;

        var structurePanel = importSecB.add("panel", undefined, "Buchstruktur & semantische TXT-Erkennung");
        structurePanel.orientation = "column";
        structurePanel.alignChildren = "left";
        structurePanel.margins = 10;
        var titlePageCheck = structurePanel.add("checkbox", undefined, "Titelseite aus den ersten 4 Metadatenzeilen erzeugen"); titlePageCheck.value = true;
        var frontmatterCheck = structurePanel.add("checkbox", undefined, "Vorspann / Gliederung / Vorwort auf eigene Seite(n) setzen"); frontmatterCheck.value = true;
        var newBodyPageCheck = structurePanel.add("checkbox", undefined, "Haupttext auf neuer Seite beginnen"); newBodyPageCheck.value = true;
        var semanticCheck = structurePanel.add("checkbox", undefined, "Semantische TXT-Erkennung aktivieren (Abschnitt/Parashah, Chapter, Vorwort/Einleitung, Haupttext)"); semanticCheck.value = true;
        var semanticStylesCheck = structurePanel.add("checkbox", undefined, "Erkannte Struktur mit eigenen InDesign-Absatzformaten gestalten"); semanticStylesCheck.value = true;


        var cleanLayoutPanel = importSecB.add("panel", undefined, "Titelseite & Vorspann · Layoutmodus");
        cleanLayoutPanel.orientation = "column";
        cleanLayoutPanel.alignChildren = "left";
        cleanLayoutPanel.margins = 10;
        cleanLayoutPanel.spacing = 6;
        var titleModeRow = cleanLayoutPanel.add("group");
        titleModeRow.add("statictext", undefined, "Titelseite:");
        var titleLayoutModeDD = titleModeRow.add("dropdownlist", undefined, [
            "Saubere Titelseite wie v2.2 (eigener zentrierter Rahmen)",
            "Ausgewählte Musterrahmen verwenden"
        ]);
        titleLayoutModeDD.selection = 0;
        titleLayoutModeDD.preferredSize.width = 430;
        var frontModeRow = cleanLayoutPanel.add("group");
        frontModeRow.add("statictext", undefined, "Vorspann:");
        var frontLayoutModeDD = frontModeRow.add("dropdownlist", undefined, [
            "Sauberer Vorspann wie v2.2 (ein Haupttextrahmen pro Seite)",
            "Ausgewählte Musterrahmen verwenden"
        ]);
        frontLayoutModeDD.selection = 0;
        frontLayoutModeDD.preferredSize.width = 430;
        cleanLayoutPanel.add("statictext", undefined,
            "Die gewählte Musterseite wird weiterhin angewendet. Im sauberen Modus verwendet nur der Text wieder die stabile v2.2-Geometrie.",
            {multiline:true}).preferredSize.width = 720;

        // -----------------------------------------------------------------
        // Real InDesign section / page-number routing.
        // -----------------------------------------------------------------
        var sectionRoutingPanel = importSecC.add("panel", undefined, "Zuordnung: Inhalt → Seitennummerierungsabschnitt");
        sectionRoutingPanel.orientation = "column";
        sectionRoutingPanel.alignChildren = "fill";
        sectionRoutingPanel.margins = 10;
        sectionRoutingPanel.spacing = 7;

        var sectionScanRow = sectionRoutingPanel.add("group");
        var sectionRefreshBtn = sectionScanRow.add("button", undefined, "Abschnitte / Seitennummerierung neu einlesen");
        var sectionSourceInfo = sectionScanRow.add("statictext", undefined, "Noch nicht eingelesen.");
        sectionSourceInfo.characters = 54;

        var sectionCatalogUI = [];

        function makeSectionRouteUI18(label, role) {
            var row = sectionRoutingPanel.add("group");
            row.orientation = "row";
            row.alignChildren = ["left","center"];
            var lab = row.add("statictext", undefined, label);
            lab.preferredSize.width = 105;
            var ddSec = row.add("dropdownlist", undefined, ["—"]);
            ddSec.preferredSize.width = 520;
            var summary = row.add("statictext", undefined, "—");
            summary.preferredSize.width = 160;
            var r={role:role,label:label,dd:ddSec,summary:summary};
            ddSec.onChange=function(){ updateSectionRouteSummaryUI18(r); };
            return r;
        }

        var titleSectionRouteUI = makeSectionRouteUI18("Titelseite:", "title");
        var frontSectionRouteUI = makeSectionRouteUI18("Vorspann:", "frontmatter");
        var bodySectionRouteUI  = makeSectionRouteUI18("Haupttext:", "body");

        sectionRoutingPanel.add("statictext", undefined,
            "Standard: Titelseite und Vorspann → erster römischer Abschnitt; Haupttext → erster arabischer Abschnitt. Titel und Vorspann im selben Abschnitt laufen automatisch nacheinander.",
            {multiline:true}).preferredSize.width = 780;

        function sectionStyleIsRoman18(name){ return name==="UPPER_ROMAN" || name==="LOWER_ROMAN"; }
        function sectionStyleIsArabic18(name){ return name==="ARABIC" || name==="SINGLE_LEADING_ZEROS" || name==="DOUBLE_LEADING_ZEROS" || name==="TRIPLE_LEADING_ZEROS"; }

        function sectionDropdownLabelUI18(sec){
            var range=(sec.startPageName||"?") + (sec.endPageName && sec.endPageName!==sec.startPageName ? "–"+sec.endPageName : "");
            var phys=(sec.startPhysicalPage!==null && sec.startPhysicalPage!==undefined ? "phys. "+sec.startPhysicalPage : "phys. ?");
            if(sec.endPhysicalPage!==null && sec.endPhysicalPage!==undefined && sec.endPhysicalPage!==sec.startPhysicalPage) phys += "–"+sec.endPhysicalPage;
            return "§"+sec.index+" · "+(sec.styleName||"UNBEKANNT")+" · "+range+" · "+phys;
        }

        function preferredSectionIndexUI18(kind){
            var i;
            if(kind==="roman"){
                for(i=0;i<sectionCatalogUI.length;i++) if(sectionStyleIsRoman18(sectionCatalogUI[i].styleName)) return i;
            } else if(kind==="arabic"){
                for(i=0;i<sectionCatalogUI.length;i++) if(sectionStyleIsArabic18(sectionCatalogUI[i].styleName)) return i;
            }
            return -1;
        }

        function setSectionRouteUI18(route,index){
            if(!sectionCatalogUI.length || index<0 || index>=sectionCatalogUI.length){
                route.dd.selection=null; route.summary.text="kein passender Abschnitt"; return;
            }
            route.dd.selection=index; updateSectionRouteSummaryUI18(route);
        }

        function updateSectionRouteSummaryUI18(route){
            var i=route.dd.selection?route.dd.selection.index:-1;
            if(i<0 || i>=sectionCatalogUI.length){ route.summary.text="—"; return; }
            var sec=sectionCatalogUI[i];
            route.summary.text=sectionStyleIsRoman18(sec.styleName)?"römisch":(sectionStyleIsArabic18(sec.styleName)?"arabisch":sec.styleName);
        }

        function resolveSectionCatalogSourceUI18(){
            var report,jf,snap,d;
            if(linkCreateCheck.value){
                if(srcFileRadio.value){
                    if(!srcEdit.text) throw new Error("Reiter 2 verwendet eine JSON-Quelle. Bitte dort zuerst eine Layout-JSON auswählen.");
                    jf=new File(srcEdit.text); if(!jf.exists) throw new Error("Layout-JSON nicht gefunden: "+jf.fsName);
                    report=jsonParse(readUTF8(jf));
                    return {catalog:buildSectionCatalogFromReport18(report,true),source:"Reiter 2 · JSON: "+jf.name};
                }
                snap=capturedFirstTab || currentReadSelectionSnapshot();
                d=app.documents[snap.docIndex]; if(!d||!d.isValid) throw new Error("Quell-Dokument aus Reiter 1 ist nicht verfügbar.");
                return {catalog:buildSectionCatalogFromDocument18(d,snap.startPhysical,snap.endPhysical),source:"Reiter 2 · "+d.name};
            }
            if(app.documents.length===0) throw new Error("Kein aktives Dokument vorhanden.");
            d=app.activeDocument;
            return {catalog:buildSectionCatalogFromDocument18(d,null,null),source:"Aktives Dokument · "+d.name};
        }

        function refreshSectionCatalogUI18(){
            try{
                var src=resolveSectionCatalogSourceUI18(),i,label;
                sectionCatalogUI=src.catalog||[];
                clearDropdownUI18(titleSectionRouteUI.dd); clearDropdownUI18(frontSectionRouteUI.dd); clearDropdownUI18(bodySectionRouteUI.dd);
                for(i=0;i<sectionCatalogUI.length;i++){
                    label=sectionDropdownLabelUI18(sectionCatalogUI[i]);
                    titleSectionRouteUI.dd.add("item",label); frontSectionRouteUI.dd.add("item",label); bodySectionRouteUI.dd.add("item",label);
                }
                sectionSourceInfo.text=src.source+" · "+sectionCatalogUI.length+" Abschnitte";
                var ri=preferredSectionIndexUI18("roman"), ai=preferredSectionIndexUI18("arabic");
                setSectionRouteUI18(titleSectionRouteUI,ri);
                setSectionRouteUI18(frontSectionRouteUI,ri);
                setSectionRouteUI18(bodySectionRouteUI,ai);
                if(!sectionCatalogUI.length) sectionSourceInfo.text=src.source+" · keine geeigneten Abschnitte im Zielbereich";
            }catch(e){
                sectionCatalogUI=[]; sectionSourceInfo.text="Einlesen fehlgeschlagen: "+errText(e);
                alert("Abschnitte/Seitennummerierung konnten nicht eingelesen werden:\n\n"+errText(e),SCRIPT_NAME);
            }
        }

        function sectionRouteConfigFromUI18(route){
            var i=route.dd.selection?route.dd.selection.index:-1;
            if(i<0 || i>=sectionCatalogUI.length) return null;
            var sec=sectionCatalogUI[i];
            return {
                sectionIndex:sec.index, styleName:sec.styleName, styleRaw:sec.styleRaw, styleOrdinal:sec.styleOrdinal,
                startPageName:sec.startPageName, startPhysicalPage:sec.startPhysicalPage,
                pageNumberStart:sec.pageNumberStartConfigured, continueNumbering:sec.continueNumbering
            };
        }

        sectionRefreshBtn.onClick=refreshSectionCatalogUI18;

        // -----------------------------------------------------------------
        // Professional master/parent-page routing.
        // Existing text frames drawn by the user on A/B/etc. parent pages are
        // scanned and used as import targets. The old generated-grid mode is
        // retained only as an explicit fallback.
        // -----------------------------------------------------------------
        var masterRoutingPanel = importSecD.add("panel", undefined, "Importziel: vorhandene Muster-/Elternseiten-Rahmen");
        masterRoutingPanel.orientation = "column";
        masterRoutingPanel.alignChildren = "fill";
        masterRoutingPanel.margins = 10;
        masterRoutingPanel.spacing = 7;

        var routingModeRow = masterRoutingPanel.add("group");
        var useMasterFramesRadio = routingModeRow.add("radiobutton", undefined, "Vorhandene Musterrahmen verwenden (empfohlen)");
        var useGridFramesRadio = routingModeRow.add("radiobutton", undefined, "Eigene Rasterrahmen erzeugen (Fallback)");
        useMasterFramesRadio.value = true;

        var masterSourceRow = masterRoutingPanel.add("group");
        masterSourceRow.add("statictext", undefined, "Einlesequelle:");
        var masterSourceModeDD = masterSourceRow.add("dropdownlist", undefined, [
            "Aktives Dokument LIVE · aktuelle, auch ungespeicherte Musterseiten (empfohlen)",
            "Quelle aus Reiter 2 · JSON / übernommenes Quelldokument"
        ]);
        masterSourceModeDD.selection = 0;
        masterSourceModeDD.preferredSize.width = 555;

        var masterScanRow = masterRoutingPanel.add("group");
        var masterRefreshBtn = masterScanRow.add("button", undefined, "JETZT LIVE neu einlesen");
        masterRefreshBtn.preferredSize.width = 180;
        var masterSourceInfo = masterScanRow.add("statictext", undefined, "Noch nicht eingelesen.");
        masterSourceInfo.characters = 80;

        var masterScanDetail = masterRoutingPanel.add("statictext", undefined,
            "LIVE liest die Musterseiten bei jedem Klick neu aus dem aktiven InDesign-Dokument. Änderungen müssen vorher nicht gespeichert werden.",
            {multiline:true});
        masterScanDetail.preferredSize.width = 790;

        var startPageRow = masterRoutingPanel.add("group");
        startPageRow.add("statictext", undefined, "Import ab physischer Dokumentseite:");
        var importStartPageEdit = startPageRow.add("edittext", undefined, "1");
        importStartPageEdit.characters = 6;
        var autoApplyMasterCheck = startPageRow.add("checkbox", undefined, "Musterseite automatisch anwenden");
        autoApplyMasterCheck.value = true;

        var masterBehaviorRow = masterRoutingPanel.add("group");
        var clearMasterFrameTextCheck = masterBehaviorRow.add("checkbox", undefined, "Gewählte Zielrahmen vor dem Import leeren");
        clearMasterFrameTextCheck.value = true;
        var preserveMasterVisualCheck = masterBehaviorRow.add("checkbox", undefined, "Füllung/Kontur/Innenabstand der Musterrahmen beibehalten");
        preserveMasterVisualCheck.value = true;

        var routePanel = importSecD.add("panel", undefined, "Zuordnung: Inhalt → Musterseite → Rahmenfolge");
        routePanel.orientation = "column";
        routePanel.alignChildren = "fill";
        routePanel.margins = 10;
        routePanel.spacing = 7;

        var masterCatalogUI = [];

        function makeImportRouteUI18(label, role) {
            var row = routePanel.add("group");
            row.orientation = "row";
            row.alignChildren = ["left", "center"];
            var lab = row.add("statictext", undefined, label);
            lab.preferredSize.width = 105;
            var masterDD = row.add("dropdownlist", undefined, ["—"]);
            masterDD.preferredSize.width = 245;
            var chooseBtn = row.add("button", undefined, "Rahmenfolge …");
            chooseBtn.preferredSize.width = 110;
            var summary = row.add("statictext", undefined, "—");
            summary.preferredSize.width = 330;

            var route = {role:role,label:label,masterDD:masterDD,chooseBtn:chooseBtn,summary:summary,slots:[]};

            masterDD.onChange = function () {
                var mi = masterDD.selection ? masterDD.selection.index : -1;
                if (mi < 0 || mi >= masterCatalogUI.length) {
                    route.slots = [];
                    summary.text = "—";
                    return;
                }
                route.slots = defaultMasterSlots18(masterCatalogUI[mi], role);
                updateRouteSummaryUI18(route);
            };

            chooseBtn.onClick = function () {
                var mi = masterDD.selection ? masterDD.selection.index : -1;
                if (mi < 0 || mi >= masterCatalogUI.length) {
                    alert("Bitte zuerst Musterseiten/Textrahmen einlesen.", SCRIPT_NAME);
                    return;
                }
                var chosen = chooseMasterSlotOrderDialog18(masterCatalogUI[mi], route.slots, label);
                if (chosen) {
                    route.slots = chosen;
                    updateRouteSummaryUI18(route);
                }
            };
            return route;
        }

        var titleRouteUI = makeImportRouteUI18("Titelseite:", "title");
        var frontRouteUI = makeImportRouteUI18("Vorspann:", "frontmatter");
        var bodyRouteUI  = makeImportRouteUI18("Haupttext:", "body");

        var routeHint = routePanel.add("statictext", undefined,
            "Rahmen werden pro Musterseite als geometrische Slots erkannt. Bei Doppelseiten wird derselbe Slot automatisch auf LEFT_HAND bzw. RIGHT_HAND verwendet. Namen/Labels aus InDesign werden in der Auswahlliste angezeigt.",
            {multiline:true});
        routeHint.preferredSize.width = 790;

        function clearDropdownUI18(dd) {
            try {
                while (dd.items && dd.items.length) dd.remove(dd.items[dd.items.length - 1]);
            } catch (_) {}
        }

        function masterDropdownLabelUI18(m) {
            var textCount=0,auxCount=0,i;
            for(i=0;i<m.slots.length;i++){
                if(m.slots[i].role==="TEXT")textCount++; else auxCount++;
            }
            return (m.prefix ? m.prefix + " · " : "") + m.name +
                "  [" + m.slotCount + " Slots · " + textCount + " TEXT · " + auxCount + " AUX]";
        }

        function currentRouteMasterNameUI18(route){
            var mi=route.masterDD.selection?route.masterDD.selection.index:-1;
            if(mi>=0&&mi<masterCatalogUI.length)return safeStr(masterCatalogUI[mi].name);
            return "";
        }

        function masterIndexByNameUI18(name){
            var i,n=safeStr(name);
            if(!n)return -1;
            for(i=0;i<masterCatalogUI.length;i++)if(safeStr(masterCatalogUI[i].name)===n)return i;
            return -1;
        }

        function masterCatalogDigestUI18(catalog){
            var p=[],i,m;
            for(i=0;i<catalog.length;i++){
                m=catalog[i];
                p.push((m.prefix||m.name||("?"+i))+":"+m.slotCount);
            }
            return p.join(" · ");
        }

        function preferredMasterIndexUI18(prefix) {
            var i, n, p = String(prefix || "").toUpperCase();
            for (i = 0; i < masterCatalogUI.length; i++) {
                if (String(masterCatalogUI[i].prefix || "").toUpperCase() === p) return i;
            }
            for (i = 0; i < masterCatalogUI.length; i++) {
                n = String(masterCatalogUI[i].name || "").toUpperCase();
                if (n.indexOf(p + "-") === 0 || n.indexOf(p + " ") === 0 || n.indexOf(p + "_") === 0) return i;
            }
            return masterCatalogUI.length ? 0 : -1;
        }

        function setRouteMasterUI18(route, index) {
            if (!masterCatalogUI.length) {
                route.masterDD.selection = null;
                route.slots = [];
                route.summary.text = "keine Musterseite";
                return;
            }
            if (index < 0 || index >= masterCatalogUI.length) index = 0;
            route.masterDD.selection = index;
            route.slots = defaultMasterSlots18(masterCatalogUI[index], route.role);
            updateRouteSummaryUI18(route);
        }

        function updateRouteSummaryUI18(route) {
            var mi = route.masterDD.selection ? route.masterDD.selection.index : -1;
            if (mi < 0 || mi >= masterCatalogUI.length) {
                route.summary.text = "—";
                return;
            }
            var m = masterCatalogUI[mi], parts = [], i, slot;
            for (i = 0; i < route.slots.length; i++) {
                slot = masterSlotByIndex18(m, route.slots[i]);
                if (slot) parts.push("R" + slot.index + " " + slot.shortLabel);
            }
            route.summary.text = parts.length ? parts.join(" → ") : "kein Rahmen gewählt";
        }

        function resolveMasterCatalogSourceUI18() {
            var report, jf, snap, d;
            var mode=masterSourceModeDD.selection?masterSourceModeDD.selection.index:0;

            // v2.12: LIVE is explicit and independent of "Mit Reiter 2 koppeln".
            // This prevents an old snapshot/JSON from silently winning over the
            // master pages the user is currently editing.
            if(mode===0){
                if(app.documents.length===0)throw new Error("Kein aktives Dokument vorhanden.");
                d=app.activeDocument;
                return {catalog:buildMasterCatalogFromDocument18(d), source:"LIVE · "+d.name};
            }

            // Explicit Reiter-2 source.
            if(srcFileRadio.value){
                if(!srcEdit.text)throw new Error("Reiter 2 verwendet eine JSON-Quelle. Bitte dort zuerst eine Layout-JSON auswählen.");
                jf=new File(srcEdit.text);
                if(!jf.exists)throw new Error("Layout-JSON nicht gefunden: "+jf.fsName);
                report=jsonParse(readUTF8(jf));
                return {catalog:buildMasterCatalogFromReport18(report), source:"Reiter 2 · JSON: "+jf.name};
            }
            snap=capturedFirstTab||currentReadSelectionSnapshot();
            d=app.documents[snap.docIndex];
            if(!d||!d.isValid)throw new Error("Quell-Dokument aus Reiter 1 ist nicht verfügbar.");
            return {catalog:buildMasterCatalogFromDocument18(d), source:"Reiter 2 · "+d.name};
        }

        var masterScanRevision18=0;

        function refreshMasterCatalogUI18() {
            try {
                var oldTitle=currentRouteMasterNameUI18(titleRouteUI);
                var oldFront=currentRouteMasterNameUI18(frontRouteUI);
                var oldBody=currentRouteMasterNameUI18(bodyRouteUI);

                var src=resolveMasterCatalogSourceUI18(),i,label,idx;
                masterCatalogUI=src.catalog||[];
                masterScanRevision18++;

                clearDropdownUI18(titleRouteUI.masterDD);
                clearDropdownUI18(frontRouteUI.masterDD);
                clearDropdownUI18(bodyRouteUI.masterDD);

                for(i=0;i<masterCatalogUI.length;i++){
                    label=masterDropdownLabelUI18(masterCatalogUI[i]);
                    titleRouteUI.masterDD.add("item",label);
                    frontRouteUI.masterDD.add("item",label);
                    bodyRouteUI.masterDD.add("item",label);
                }

                // Keep the chosen master if it still exists, but deliberately
                // recompute its slot selection from the newly scanned geometry.
                idx=masterIndexByNameUI18(oldTitle);
                setRouteMasterUI18(titleRouteUI,idx>=0?idx:preferredMasterIndexUI18("A"));
                idx=masterIndexByNameUI18(oldFront);
                setRouteMasterUI18(frontRouteUI,idx>=0?idx:preferredMasterIndexUI18("A"));
                idx=masterIndexByNameUI18(oldBody);
                setRouteMasterUI18(bodyRouteUI,idx>=0?idx:preferredMasterIndexUI18("B"));

                var now="";
                try{now=(new Date()).toLocaleTimeString();}catch(_){now=String(masterScanRevision18);}
                masterSourceInfo.text=src.source+" · Scan #"+masterScanRevision18+" · "+now;
                masterScanDetail.text=masterCatalogUI.length
                    ? ("Neu aufgelöst: "+masterCatalogDigestUI18(masterCatalogUI)+
                       ". Rahmenfolge nach Änderungen bitte kurz kontrollieren; IDs und echte mm-Maße stehen im Auswahlfenster.")
                    : (src.source+" · keine geeigneten Musterseiten/Textrahmen gefunden");

                if(!masterCatalogUI.length){
                    masterSourceInfo.text=src.source+" · keine geeigneten Musterseiten/Textrahmen gefunden";
                }
            } catch (e) {
                masterCatalogUI=[];
                masterSourceInfo.text="Einlesen fehlgeschlagen: "+errText(e);
                masterScanDetail.text="LIVE-Scan fehlgeschlagen.";
                alert("Musterseiten/Textrahmen konnten nicht eingelesen werden:\n\n"+errText(e),SCRIPT_NAME);
            }
        }

        masterSourceModeDD.onChange=function(){
            try{refreshMasterCatalogUI18();}catch(_){}
        };

        function routeConfigFromUI18(route) {
            var mi = route.masterDD.selection ? route.masterDD.selection.index : -1;
            if (mi < 0 || mi >= masterCatalogUI.length) return null;
            var m = masterCatalogUI[mi];
            return {
                masterName:m.name,
                masterPrefix:m.prefix,
                slotIndices:route.slots.slice(0),
                catalogIndex:mi
            };
        }

        masterRefreshBtn.onClick = refreshMasterCatalogUI18;

        var flowPanel = importSecE.add("panel", undefined, "Fallback: eigenes Haupttext-Raster / Rahmenanordnung");
        flowPanel.orientation = "column";
        flowPanel.alignChildren = "left";
        flowPanel.margins = 10;
        var frameRow = flowPanel.add("group");
        frameRow.add("statictext", undefined, "Textrahmen pro Seite:");
        var frameCountDD = frameRow.add("dropdownlist", undefined, ["1", "2", "3", "4"]);
        frameCountDD.selection = 0;
        frameRow.add("statictext", undefined, "Anordnung:");
        var frameLayoutDD = frameRow.add("dropdownlist", undefined, [
            "Automatisch",
            "Nebeneinander",
            "Untereinander",
            "2 × 2 Raster",
            "1 oben + 2 unten",
            "2 oben + 1 unten"
        ]);
        frameLayoutDD.selection = 0;

        var gapRow = flowPanel.add("group");
        gapRow.add("statictext", undefined, "Horizontaler Abstand:");
        var gapXEdit = gapRow.add("edittext", undefined, "4"); gapXEdit.characters = 4;
        gapRow.add("statictext", undefined, "mm   Vertikaler Abstand:");
        var gapYEdit = gapRow.add("edittext", undefined, "4"); gapYEdit.characters = 4;
        gapRow.add("statictext", undefined, "mm");
        var autoPagesCheck = flowPanel.add("checkbox", undefined, "Automatisch neue Seiten ergänzen, bis der gesamte Text Platz hat"); autoPagesCheck.value = true;
        var clearPagesCheck = flowPanel.add("checkbox", undefined, "Direkte Seitenobjekte auf benutzten Importseiten vor dem Einfügen löschen"); clearPagesCheck.value = true;

        var colorPanel = importSecE.add("panel", undefined, "Rahmenfarben · Tzurba-M’Rabanan-Stil");
        colorPanel.orientation = "column";
        colorPanel.alignChildren = "left";
        colorPanel.margins = 10;
        var colorTopRow = colorPanel.add("group");
        var frameColorCheck = colorTopRow.add("checkbox", undefined, "Rahmen farbig gestalten"); frameColorCheck.value = true;
        colorTopRow.add("statictext", undefined, "Preset:");
        var frameColorPresetDD = colorTopRow.add("dropdownlist", undefined, [
            "Tzurba · Blau / Weiß / Gelb / Rot",
            "Tzurba · Blau / Gelb alternierend",
            "nur Blau · Q/A",
            "nur Gelb · Bottom Line",
            "nur Rot · Hinweis",
            "Benutzerdefiniert",
            "Keine Farbe"
        ]);
        frameColorPresetDD.selection = 0;

        var colorHexRow = colorPanel.add("group");
        colorHexRow.add("statictext", undefined, "F1 #"); var frameHex1 = colorHexRow.add("edittext", undefined, "D0E8FF"); frameHex1.characters = 7;
        colorHexRow.add("statictext", undefined, "F2 #"); var frameHex2 = colorHexRow.add("edittext", undefined, "FFFFFF"); frameHex2.characters = 7;
        colorHexRow.add("statictext", undefined, "F3 #"); var frameHex3 = colorHexRow.add("edittext", undefined, "FFF5B1"); frameHex3.characters = 7;
        colorHexRow.add("statictext", undefined, "F4 #"); var frameHex4 = colorHexRow.add("edittext", undefined, "FFCCCC"); frameHex4.characters = 7;

        var colorStyleRow = colorPanel.add("group");
        colorStyleRow.add("statictext", undefined, "Innenabstand:");
        var frameInsetEdit = colorStyleRow.add("edittext", undefined, "1.6"); frameInsetEdit.characters = 4;
        colorStyleRow.add("statictext", undefined, "mm   Kontur:");
        var frameStrokeEdit = colorStyleRow.add("edittext", undefined, "0.5"); frameStrokeEdit.characters = 4;
        colorStyleRow.add("statictext", undefined, "pt   Kontur #");
        var frameStrokeHex = colorStyleRow.add("edittext", undefined, "B7C7D9"); frameStrokeHex.characters = 7;

        function applyFrameColorPresetUI() {
            var idx = frameColorPresetDD.selection ? frameColorPresetDD.selection.index : 0;
            frameColorCheck.value = idx !== 6;
            if (idx === 0) { frameHex1.text="D0E8FF"; frameHex2.text="FFFFFF"; frameHex3.text="FFF5B1"; frameHex4.text="FFCCCC"; }
            else if (idx === 1) { frameHex1.text="D0E8FF"; frameHex2.text="FFF5B1"; frameHex3.text="D0E8FF"; frameHex4.text="FFF5B1"; }
            else if (idx === 2) { frameHex1.text="D0E8FF"; frameHex2.text="D0E8FF"; frameHex3.text="D0E8FF"; frameHex4.text="D0E8FF"; }
            else if (idx === 3) { frameHex1.text="FFF5B1"; frameHex2.text="FFF5B1"; frameHex3.text="FFF5B1"; frameHex4.text="FFF5B1"; }
            else if (idx === 4) { frameHex1.text="FFCCCC"; frameHex2.text="FFCCCC"; frameHex3.text="FFCCCC"; frameHex4.text="FFCCCC"; }
        }
        frameColorPresetDD.onChange = applyFrameColorPresetUI;

        // Keep the master-frame catalog in sync when the source mode changes.
        // v2.12: catalog source is explicit. Reiter-2 controls no longer
        // silently redirect the LIVE master scan. If "Quelle aus Reiter 2"
        // is selected, clicking the refresh button reads those controls.
        useMasterFramesRadio.onClick = function () { useGridFramesRadio.value = false; };
        useGridFramesRadio.onClick = function () { useMasterFramesRadio.value = false; };


        // -----------------------------------------------------------------
        // v2.6: OpenAI / AI tools. The API key is never written into the JSX
        // or project data. Preferred source is OPENAI_API_KEY environment var.
        // -----------------------------------------------------------------
        var aiPanel = importSecAI.add("panel", undefined, "OpenAI API · Vorbereitung für KI-Werkzeuge");
        aiPanel.orientation = "column";
        aiPanel.alignChildren = "fill";
        aiPanel.margins = 10;
        aiPanel.spacing = 7;

        var aiAuthRow = aiPanel.add("group");
        var aiEnvKeyCheck = aiAuthRow.add("checkbox", undefined, "OPENAI_API_KEY aus Umgebungsvariable verwenden (empfohlen)");
        aiEnvKeyCheck.value = true;
        aiAuthRow.add("statictext", undefined, "oder API-Key nur für diese Sitzung:");
        var aiKeyEdit = aiAuthRow.add("edittext", undefined, "", {noecho:true});
        aiKeyEdit.characters = 27;
        aiKeyEdit.enabled = false;

        var aiApiRow = aiPanel.add("group");
        aiApiRow.add("statictext", undefined, "Model:");
        var aiModelEdit = aiApiRow.add("edittext", undefined, "gpt-5-mini");
        aiModelEdit.characters = 18;
        aiApiRow.add("statictext", undefined, "Endpoint:");
        var aiEndpointEdit = aiApiRow.add("edittext", undefined, "https://api.openai.com/v1/responses");
        aiEndpointEdit.characters = 43;
        var aiTestBtn = aiApiRow.add("button", undefined, "Verbindung testen");

        var aiPrefacePanel = importSecAI.add("panel", undefined, "Vorspann erzeugen");
        aiPrefacePanel.orientation = "column";
        aiPrefacePanel.alignChildren = "fill";
        aiPrefacePanel.margins = 10;
        aiPrefacePanel.spacing = 7;

        var aiPrefaceRow = aiPrefacePanel.add("group");
        aiPrefaceRow.add("statictext", undefined, "Sprache:");
        var aiLanguageDD = aiPrefaceRow.add("dropdownlist", undefined, ["Deutsch","Englisch","Hebräisch"]);
        aiLanguageDD.selection = 0;
        aiPrefaceRow.add("statictext", undefined, "Zielumfang:");
        var aiWordsEdit = aiPrefaceRow.add("edittext", undefined, "450");
        aiWordsEdit.characters = 6;
        aiPrefaceRow.add("statictext", undefined, "Wörter");
        aiPrefaceRow.add("statictext", undefined, "Kontext:");
        var aiContextDD = aiPrefaceRow.add("dropdownlist", undefined, [
            "Titel + Metadaten",
            "Titel + Metadaten + Anfang des Haupttexts"
        ]);
        aiContextDD.selection = 1;
        aiContextDD.preferredSize.width = 300;
        var aiGenerateBtn = aiPrefaceRow.add("button", undefined, "Vorspann erzeugen");

        var aiGeneratedPreface18 = "";
        var aiOutputEdit = aiPrefacePanel.add("edittext", undefined, "", {multiline:true, scrolling:true});
        aiOutputEdit.preferredSize = [805, 230];

        var aiUseRow = aiPrefacePanel.add("group");
        var aiUsePrefaceCheck = aiUseRow.add("checkbox", undefined, "Diesen KI-Text als Vorspann verwenden");
        aiUsePrefaceCheck.value = false;
        aiUseRow.add("statictext", undefined, "Einfügen:");
        var aiPrefaceModeDD = aiUseRow.add("dropdownlist", undefined, [
            "ersetzt einen TXT-Vorspann",
            "vor vorhandenen TXT-Vorspann setzen"
        ]);
        aiPrefaceModeDD.selection = 0;
        var aiStatus = aiUseRow.add("statictext", undefined, "Noch kein KI-Text erzeugt.");
        aiStatus.characters = 38;

        importSecAI.add("statictext", undefined,
            "Sicherheit: Der Schlüssel wird nicht in der JSX gespeichert. Bei Nutzung des Sitzungsfelds wird er nur für den API-Aufruf in einer temporären curl-Konfiguration verwendet und danach gelöscht. Der erzeugte Text wird erst importiert, wenn „Diesen KI-Text als Vorspann verwenden“ aktiviert ist.",
            {multiline:true}).preferredSize.width = 790;

        aiEnvKeyCheck.onClick = function(){ aiKeyEdit.enabled = !aiEnvKeyCheck.value; };

        function collectOpenAIConfigUI18() {
            var words=parseInt(aiWordsEdit.text,10); if(isNaN(words)||words<100)words=450;
            if(words>2500)words=2500;
            return {
                useEnvironment:aiEnvKeyCheck.value,
                apiKey:aiKeyEdit.text,
                model:trim18(aiModelEdit.text)||"gpt-5-mini",
                endpoint:trim18(aiEndpointEdit.text)||"https://api.openai.com/v1/responses",
                language:aiLanguageDD.selection?aiLanguageDD.selection.text:"Deutsch",
                words:words,
                contextMode:aiContextDD.selection?aiContextDD.selection.index:1
            };
        }

        function ensureAnalyzedForAI18() {
            if(!txtPathEdit.text) throw new Error("Bitte zuerst eine TXT-Datei auswählen.");
            var f=new File(txtPathEdit.text); if(!f.exists) throw new Error("TXT-Datei nicht gefunden.");
            if(!analyzedTxtRaw) analyzedTxtRaw=readUTF8(f);
            if(!analyzedTxt) {
                analyzedTxt=analyzeBookTxt(analyzedTxtRaw);
                initializeTxtSplitUI18();
                refreshTxtPreviewUI18();
            }
            return applyTxtSplitConfig18(analyzedTxt, analyzedTxtRaw, txtSplitConfigFromUI18());
        }

        function buildAIPrefacePrompt18(a,cfg) {
            var context="";
            if(cfg.contextMode===1 && a.body) {
                context=String(a.body);
                if(context.length>14000) context=context.substr(0,14000);
            }
            var p=
                "Erstelle einen sachlichen, druckreifen Vorspann für ein Buch.\\n"+
                "Sprache: "+cfg.language+".\\n"+
                "Umfang ungefähr "+cfg.words+" Wörter.\\n"+
                "Verwende ausschließlich die bereitgestellten Metadaten und den Textausschnitt. "+
                "Erfinde keine bibliografischen, historischen, biografischen oder religionswissenschaftlichen Fakten, die daraus nicht sicher hervorgehen. "+
                "Wenn Informationen fehlen, formuliere zurückhaltend. Kein Markdown, keine Aufzählungszeichen, keine Meta-Kommentare. "+
                "Der Text soll direkt als Buchvorspann verwendbar sein.\\n\\n"+
                "Titel: "+(a.title||"")+"\\n"+
                "Hebräischer Titel: "+(a.hebrewTitle||"")+"\\n"+
                "Quelle/Herausgeber: "+(a.publisher||"")+"\\n"+
                "URL/Quelle: "+(a.url||"");
            if(context) p+="\\n\\nAnfang des Haupttexts:\\n"+context;
            return p;
        }

        aiTestBtn.onClick=function(){
            try{
                aiStatus.text="API wird getestet …";
                var cfg=collectOpenAIConfigUI18();
                var out=openAIResponsesText18(cfg,"Antworte ausschließlich mit dem Wort OK.",80);
                aiStatus.text="API erreichbar: "+trim18(out).substr(0,45);
            }catch(e){ aiStatus.text="API-Fehler"; alert("OpenAI-API-Test fehlgeschlagen:\\n\\n"+errText(e),SCRIPT_NAME); }
        };

        aiGenerateBtn.onClick=function(){
            try{
                aiStatus.text="Vorspann wird erzeugt …";
                var a=ensureAnalyzedForAI18(), cfg=collectOpenAIConfigUI18();
                var prompt=buildAIPrefacePrompt18(a,cfg);
                var maxTokens=Math.max(400,Math.min(5000,Math.round(cfg.words*2.2)));
                aiGeneratedPreface18=openAIResponsesText18(cfg,prompt,maxTokens);
                aiOutputEdit.text=aiGeneratedPreface18;
                aiUsePrefaceCheck.value=true;
                frontmatterCheck.value=true;
                aiStatus.text="Vorspann erzeugt · "+aiGeneratedPreface18.length+" Zeichen";
            }catch(e){ aiStatus.text="Erzeugung fehlgeschlagen"; alert("Vorspann konnte nicht erzeugt werden:\\n\\n"+errText(e),SCRIPT_NAME); }
        };

        aiOutputEdit.onChanging=function(){
            aiGeneratedPreface18=aiOutputEdit.text;
        };

        var importTargetPanel = importSecA.add("panel", undefined, "Ziel ohne Reiter-2-Kopplung");
        importTargetPanel.orientation = "row";
        importTargetPanel.margins = 10;
        importTargetPanel.add("statictext", undefined, "Wenn Reiter 2 nicht gekoppelt ist: aktives Dokument verwenden.");

        try { readSub.selection   = 0; } catch (_) {}
        try { createSub.selection = 0; } catch (_) {}
        try { toolsSub.selection  = 0; } catch (_) {}
        try { fastSub.selection   = 0; } catch (_) {}
        try { importSub.selection = 0; } catch (_) {}
        try { refreshMasterCatalogUI18(); } catch (_) {}


        tabs.selection = readTab;

        var btn = w.add("group");
        btn.orientation = "row";
        btn.alignment = ["fill", "bottom"];
        btn.alignChildren = ["left", "center"];
        btn.spacing = 6;

        var uiHint = btn.add("statictext", undefined,
            "Die Einstellungen jedes Reiters sind in Abschnitte aufgeteilt \u2013 oben umschalten.");
        uiHint.alignment = ["left", "center"];
        uiHint.preferredSize.width = 480;

        var btnSpacer = btn.add("group");
        btnSpacer.alignment = ["fill", "center"];
        btnSpacer.minimumSize.width = 0;

        var closeBtn = btn.add("button", undefined, "Schließen");
        var runBtn = btn.add("button", undefined, "Layout-JSON erzeugen");

        function collectReadOptions() {
            if (app.documents.length === 0) throw new Error("Kein InDesign-Dokument geöffnet.");
            var d = app.documents[dd.selection ? dd.selection.index : 0];
            var total = d.pages.length, start = 0, end = 0;
            if (allRadio.value) {
                start = 0; end = Math.max(0, total - 1);
            } else if (firstRadio.value) {
                var n = parseInt(nEdit.text, 10); if (isNaN(n) || n < 1) n = 10; if (n > total) n = total;
                start = 0; end = Math.max(0, n - 1);
            } else {
                var a = parseInt(fromEdit.text, 10), b = parseInt(toEdit.text, 10);
                if (isNaN(a) || a < 1) a = 1; if (isNaN(b) || b < a) b = a;
                if (a > total) a = total; if (b > total) b = total;
                start = a - 1; end = b - 1;
            }
            return {mode:"read", docIndex:dd.selection ? dd.selection.index : 0, outputFolder:fe.text, startIndex:start, endIndex:end,
                includeSections:incSections.value, includeMasters:incMasters.value, includeBasedOnMasters:incChain.value,
                includeMasterTextContents:incMasterContents.value, includeMasterTypography:incMasterTypography.value,
                textFrames:tf.value, shapes:shapes.value, lines:lines.value, groups:groups.value};
        }

        function collectToolOptions() {
            var selectedTool = "format";
            if (nikkudRadio.value) selectedTool = "nikkud"; else if (dageshRadio.value) selectedTool = "dagesh";
            else if (shinRadio.value) selectedTool = "shin"; else if (transRadio.value) selectedTool = "transliteration";
            else if (unicodeRadio.value) selectedTool = "unicode";
            var bsz=parseFloat(baseSizeEdit.text); if(isNaN(bsz)||bsz<=0)bsz=9;
            var ssz=parseFloat(smallSizeEdit.text); if(isNaN(ssz)||ssz<=0)ssz=8;
            var gsz=parseFloat(bigSizeEdit.text); if(isNaN(gsz)||gsz<=0)gsz=18;
            var tsz=parseFloat(transSizeEdit.text); if(isNaN(tsz)||tsz<=0)tsz=6;
            return {mode:"tools",tool:selectedTool,presetIndex:presetDD.selection?presetDD.selection.index:0,baseSize:bsz,smallSize:ssz,bigSize:gsz,
                alignment:(alignDD.selection&&alignDD.selection.index===1)?"center":"left",processTags:tagsCheck.value,twoPass:twoPassCheck.value,
                old8to10:old8to10.value,useLegacyCharStyles:legacyStylesCheck.value,translitFont:transFontEdit.text,translitSize:tsz,
                unicodeScope:(unicodeScopeDD.selection&&unicodeScopeDD.selection.index===1)?"document":"selection"};
        }

        function collectFastOptions() {
            var base=parseFloat(fastBaseSizeEdit.text); if(isNaN(base)||base<=0)base=9;
            var small=parseFloat(fastSmallSizeEdit.text); if(isNaN(small)||small<=0)small=8;
            var big=parseFloat(fastBigSizeEdit.text); if(isNaN(big)||big<=0)big=18;
            var minChars=parseInt(fastMinCharsEdit.text,10); if(isNaN(minChars)||minChars<0)minChars=500;
            var ai=fastAlignDD.selection?fastAlignDD.selection.index:0;
            var align=ai===1?"left":(ai===2?"center":(ai===3?"right":"justify"));
            return {
                mode:"fastText",
                engine:(fastEngineDD.selection&&fastEngineDD.selection.index===1)?"liveStyle":"direct",
                scope:fastScopeDD.selection?fastScopeDD.selection.index:1,
                skipShortStories:fastMinCharsCheck.value,
                minStoryChars:minChars,
                latinFontFamily:fastLatinFontEdit.text||"Cambria",
                hebrewFontFamily:fastHebrewFontEdit.text||"Keter YG",
                baseSize:base, smallSize:small, bigSize:big,
                alignment:align,
                leadingMode:"unchanged",leadingValue:null,autoLeadingPercent:null,
                worldReady:fastWorldReadyCheck.value,
                resetStyles:fastResetStylesCheck.value,
                clearOverrides:fastClearOverridesCheck.value,
                hebrewGrep:fastHebrewCheck.value,
                processHtml:fastHtmlCheck.value,
                stripTags:fastStripTagsCheck.value,
                removeNikkud:fastNikkudCheck.value,
                removeDagesh:fastDageshCheck.value,
                disableRedraw:fastRedrawCheck.value,
                recomposeOnce:fastRecomposeCheck.value
            };
        }

        function collectCreateOptions() {
            if (srcFileRadio.value && !srcEdit.text) throw new Error("Bitte eine Layout-JSON-Datei auswählen oder die Übernahme aus Reiter 1 verwenden.");
            var snap = capturedFirstTab;
            if (!snap && srcReadRadio.value) snap = currentReadSelectionSnapshot();
            return {mode:"create",sourceMode:srcFileRadio.value?"file":"takeover",sourceJsonPath:srcEdit.text,snapshot:snap,newDocName:newName.text,
                createOutputFolder:createFolderEdit.text,saveCreatedDocument:saveCreated.value,createIncludeDocPrefs:c1.value,
                createIncludeSections:c2.value,createIncludeMasters:c3.value,createIncludeMasterTypography:c4.value};
        }

        function collectImportOptions() {
            if (!txtPathEdit.text) throw new Error("Bitte eine TXT-Datei auswählen.");
            var gapX=parseFloat(gapXEdit.text); if(isNaN(gapX)||gapX<0)gapX=4;
            var gapY=parseFloat(gapYEdit.text); if(isNaN(gapY)||gapY<0)gapY=4;
            var inset=parseFloat(frameInsetEdit.text); if(isNaN(inset)||inset<0)inset=1.6;
            var stroke=parseFloat(frameStrokeEdit.text); if(isNaN(stroke)||stroke<0)stroke=0.5;
            var importStart=parseInt(importStartPageEdit.text,10); if(isNaN(importStart)||importStart<1)importStart=1;
            if (useMasterFramesRadio.value && !masterCatalogUI.length) refreshMasterCatalogUI18();
            if (!sectionCatalogUI.length) refreshSectionCatalogUI18();

            var splitCfg=txtSplitConfigFromUI18();
            var aiPrefaceActive=!!(aiUsePrefaceCheck.value && trim18(aiOutputEdit.text));
            var effectiveFrontmatter=(splitCfg.mode!=="titleBody" && frontmatterCheck.value) || aiPrefaceActive;
            var importTypoCfg=collectImportTypographyUI18();
            var footCfg=collectFootnoteOptionsUI18();
            if(importTypoCfg.footnoteRelative){
                footCfg.pointSize=importTypoCfg.computedFootnoteSize;
                footCfg.leading=importTypoCfg.computedFootnoteLeading;
            }
            var result={mode:"import",txtPath:txtPathEdit.text,analysis:analyzedTxt,txtSplitConfig:splitCfg,
                importTypography:importTypoCfg,
                footnotes:footCfg,
                performance:collectLargeImportOptionsUI18(),
                aiPreface:{enabled:aiPrefaceActive,text:aiOutputEdit.text,mode:(aiPrefaceModeDD.selection&&aiPrefaceModeDD.selection.index===1)?"prepend":"replace"},
                linkCreate:linkCreateCheck.value,linkTools:linkToolsCheck.value,linkFast:linkFastCheck.value,
                allowLargeTools:largeToolsCheck.value,titlePage:titlePageCheck.value,frontmatter:effectiveFrontmatter,newBodyPage:newBodyPageCheck.value,
                semantic:semanticCheck.value,semanticStyles:semanticStylesCheck.value,
                titleLayoutMode:(titleLayoutModeDD.selection&&titleLayoutModeDD.selection.index===1)?"masterFrames":"clean",
                frontLayoutMode:(frontLayoutModeDD.selection&&frontLayoutModeDD.selection.index===1)?"masterFrames":"clean",
                sectionRoutes:{title:sectionRouteConfigFromUI18(titleSectionRouteUI),frontmatter:sectionRouteConfigFromUI18(frontSectionRouteUI),body:sectionRouteConfigFromUI18(bodySectionRouteUI)},
                useMasterFrames:useMasterFramesRadio.value,importStartPhysical:importStart,
                masterAutoApply:autoApplyMasterCheck.value,masterClearText:clearMasterFrameTextCheck.value,
                preserveMasterVisual:preserveMasterVisualCheck.value,
                masterRoutes:{
                    title:routeConfigFromUI18(titleRouteUI),
                    frontmatter:routeConfigFromUI18(frontRouteUI),
                    body:routeConfigFromUI18(bodyRouteUI)
                },
                framesPerPage:(frameCountDD.selection?frameCountDD.selection.index:0)+1,
                frameLayout:frameLayoutDD.selection?frameLayoutDD.selection.index:0,gapXmm:gapX,gapYmm:gapY,
                autoPages:autoPagesCheck.value,clearImportPages:clearPagesCheck.value,
                frameColors:frameColorCheck.value,colorPreset:frameColorPresetDD.selection?frameColorPresetDD.selection.index:0,
                frameHex:[frameHex1.text,frameHex2.text,frameHex3.text,frameHex4.text],frameInsetMm:inset,
                frameStrokePt:stroke,frameStrokeHex:frameStrokeHex.text};

            if (!result.sectionRoutes.title && result.titlePage) throw new Error("Für die Titelseite muss ein Seitennummerierungsabschnitt gewählt werden.");
            if (!result.sectionRoutes.frontmatter && result.frontmatter) throw new Error("Für den Vorspann muss ein Seitennummerierungsabschnitt gewählt werden.");
            if (!result.sectionRoutes.body) throw new Error("Für den Haupttext muss ein Seitennummerierungsabschnitt gewählt werden.");
            if (result.linkCreate && !c2.value) throw new Error("Die Abschnittszuordnung benötigt in Reiter 2 die Option „Abschnitte und Seitennummerierung übernehmen“.");

            if (result.useMasterFrames) {
                if (!masterCatalogUI.length) {
                    refreshMasterCatalogUI18();
                }
                if (!result.masterRoutes.body || !result.masterRoutes.body.slotIndices.length) {
                    throw new Error("Für den Haupttext muss eine Musterseite und mindestens ein Zielrahmen gewählt werden.");
                }
                if (result.titlePage && (!result.masterRoutes.title || (result.titleLayoutMode==="masterFrames" && !result.masterRoutes.title.slotIndices.length))) {
                    throw new Error("Für die Titelseite muss eine Musterseite gewählt werden; im Musterrahmen-Modus zusätzlich mindestens ein Zielrahmen.");
                }
                if (result.frontmatter && (!result.masterRoutes.frontmatter || (result.frontLayoutMode==="masterFrames" && !result.masterRoutes.frontmatter.slotIndices.length))) {
                    throw new Error("Für den Vorspann muss eine Musterseite gewählt werden; im Musterrahmen-Modus zusätzlich mindestens ein Zielrahmen.");
                }
                if (result.linkCreate && !c3.value) {
                    throw new Error("Musterrahmen-Modus benötigt in Reiter 2 die Option „Muster-/Elternseiten und Rahmen rekonstruieren“.");
                }
            }

            if (result.linkCreate) result.createOptions=collectCreateOptions();
            if (result.linkTools) { result.toolOptions=collectToolOptions(); result.toolOptions.tool="format"; result.toolOptions.refreshFromSelection=false; }
            if (result.linkFast) { result.fastOptions=collectFastOptions(); result.fastOptions.scope=0; }
            return result;
        }

        function updateRunState() {
            var onRead=(tabs.selection===readTab), onCreate=(tabs.selection===createTab), onTools=(tabs.selection===toolsTab), onFast=(tabs.selection===fastTab);
            if(onRead) runBtn.text="Layout-JSON erzeugen";
            else if(onCreate) runBtn.text="Neues Dokument anlegen";
            else if(onTools) runBtn.text="Text-Werkzeug ausführen";
            else if(onFast) runBtn.text="FAST formatieren";
            else runBtn.text="TXT importieren & Buch aufbauen";
            if(onCreate&&!capturedFirstTab) refreshLiveReadSummary();
        }
        tabs.onChange=updateRunState;
        updateRunState();

        runBtn.onClick=function(){
            try {
                if(tabs.selection===readTab) runReadExportWorkflow(collectReadOptions());
                else if(tabs.selection===createTab) runCreateWorkflow(collectCreateOptions());
                else if(tabs.selection===toolsTab) runTextToolsWorkflow(collectToolOptions());
                else if(tabs.selection===fastTab) runFastTextWorkflow18(collectFastOptions());
                else runTxtBookWorkflow(collectImportOptions());
            } catch(e) { alert("Aktion konnte nicht gestartet werden:\n\n"+errText(e), SCRIPT_NAME); }
        };
        closeBtn.onClick=function(){ try{$.global.__ID_LAYOUT_TOOLKIT_V214__=null;}catch(_){} try{w.close();}catch(_){} };
        w.onClose=function(){ try{$.global.__ID_LAYOUT_TOOLKIT_V214__=null;}catch(_){} };
        w.onResizing = w.onResize = function () {
            try { this.layout.resize(); } catch (_) {}
        };
        w.center();
        w.show();
        try { w.layout.resize(); } catch (_) {}
        try { w.active=true; } catch (_) {}
        return w;
    }

    function runReadExportWorkflow(opt) {
        var doc = app.documents[opt.docIndex];
        if (!doc || !doc.isValid) {
            alert("Das ausgewählte Dokument ist nicht verfügbar.");
            return;
        }

        var oldUnit = null;
        var logFile = null;
        var progress = null;

        try {
            var folder = new Folder(opt.outputFolder);
            if (!folder.exists && !folder.create()) {
                throw new Error("Exportordner konnte nicht erstellt werden: " + folder.fsName);
            }

            var base = safeBase(doc.name);
            var stamp = stampNow();
            var jsonFile = new File(folder.fsName + "/" + base + "_layout_LITE_" + stamp + ".json");
            logFile = new File(folder.fsName + "/" + base + "_layout_LITE_" + stamp + ".log");
            openLog(logFile);
            logLine(logFile, "START v" + SCRIPT_VERSION + " build " + BUILD);
            logLine(logFile, "Document: " + doc.name);

            oldUnit = app.scriptPreferences.measurementUnit;
            app.scriptPreferences.measurementUnit = MeasurementUnits.POINTS;

            progress = createProgress();
            progress.show();
            setProgress(progress, 2, "Dokumentdaten …");

            var report = buildReportFromDoc(doc, opt, progress, logFile);

            setProgress(progress, 88, "JSON schreiben …");
            logLine(logFile, "JSON stringify begin");
            var json = jsonStringify(report);
            logLine(logFile, "JSON stringify end chars=" + json.length);
            writeUTF8(jsonFile, json);
            logLine(logFile, "JSON write end: " + jsonFile.fsName);
            setProgress(progress, 100, "Fertig");

            try { progress.close(); } catch (_) {}
            progress = null;
            closeLog(logFile);
            logFile = null;

            alert(
                "LITE+ Export abgeschlossen.\n\n" +
                jsonFile.fsName +
                "\n\nNormale Seiten: Geometrie. Muster-/Elternseiten: zusätzlich gezielte Typografie der Textrahmen.",
                SCRIPT_NAME
            );
        } catch (e) {
            try { if (logFile) logLine(logFile, "ERROR: " + errText(e)); } catch (_) {}
            try { if (logFile) closeLog(logFile); } catch (_) {}
            try { if (progress) progress.close(); } catch (_) {}
            alert("Fehler:\n\n" + errText(e), SCRIPT_NAME);
        } finally {
            if (oldUnit !== null) {
                try { app.scriptPreferences.measurementUnit = oldUnit; } catch (_) {}
            }
        }
    }

    function runCreateWorkflow(opt) {
        var oldUnit = null;
        var logFile = null;
        var progress = null;
        var saveFile = null;
        try {
            var outFolder = new Folder(opt.createOutputFolder || Folder.desktop.fsName);
            if (!outFolder.exists && !outFolder.create()) {
                throw new Error("Speicherordner konnte nicht erstellt werden: " + outFolder.fsName);
            }

            var targetName = normalizeInddName(opt.newDocName || "Neues_Dokument.indd");
            var stamp = stampNow();
            logFile = new File(outFolder.fsName + "/" + safeBase(targetName) + "_create_" + stamp + ".log");
            openLog(logFile);
            logLine(logFile, "START CREATE v" + SCRIPT_VERSION + " build " + BUILD);
            logLine(logFile, "Source mode: " + opt.sourceMode);

            oldUnit = app.scriptPreferences.measurementUnit;
            app.scriptPreferences.measurementUnit = MeasurementUnits.POINTS;

            progress = createProgress();
            progress.show();
            setProgress(progress, 4, "Quelle lesen …");

            var report = null;
            if (opt.sourceMode === "file") {
                var f = new File(opt.sourceJsonPath);
                if (!f.exists) throw new Error("Layout-JSON-Datei nicht gefunden: " + f.fsName);
                var txt = readUTF8(f);
                report = jsonParse(txt);
                logLine(logFile, "Loaded JSON source: " + f.fsName);
            } else {
                if (!opt.snapshot) throw new Error("Es liegt keine Übernahme aus Reiter 1 vor.");
                var d = app.documents[opt.snapshot.docIndex];
                if (!d || !d.isValid) throw new Error("Das Quell-Dokument aus Reiter 1 ist nicht verfügbar.");
                var readOpt = {
                    startIndex: Math.max(0, Number(opt.snapshot.startPhysical) - 1),
                    endIndex: Math.max(0, Number(opt.snapshot.endPhysical) - 1),
                    includeSections: !!opt.snapshot.includeSections,
                    includeMasters: !!opt.snapshot.includeMasters,
                    includeBasedOnMasters: !!opt.snapshot.includeBasedOnMasters,
                    includeMasterTextContents: !!opt.snapshot.includeMasterTextContents,
                    includeMasterTypography: !!opt.snapshot.includeMasterTypography,
                    textFrames: !!opt.snapshot.textFrames,
                    shapes: !!opt.snapshot.shapes,
                    lines: !!opt.snapshot.lines,
                    groups: !!opt.snapshot.groups
                };
                logLine(logFile, "Takeover document: " + d.name);
                report = buildReportFromDoc(d, readOpt, progress, logFile);
            }

            setProgress(progress, 18, "Neues Dokument erstellen …");
            var newDoc = createDocumentFromReport(report, opt, progress, logFile);

            if (opt.saveCreatedDocument) {
                saveFile = new File(outFolder.fsName + "/" + targetName);
                newDoc.save(saveFile);
                logLine(logFile, "SAVE: " + saveFile.fsName);
            }

            setProgress(progress, 100, "Fertig");
            try { progress.close(); } catch (_) {}
            progress = null;
            closeLog(logFile);
            logFile = null;

            alert(
                "Neues InDesign-Dokument wurde erstellt." +
                (saveFile ? "\n\nGespeichert unter:\n" + saveFile.fsName : "\n\nDas Dokument ist geöffnet, aber noch nicht gespeichert.") +
                "\n\nSeiten: " + safeLength(report.pages),
                SCRIPT_NAME
            );
        } catch (e) {
            try { if (logFile) logLine(logFile, "ERROR: " + errText(e)); } catch (_) {}
            try { if (logFile) closeLog(logFile); } catch (_) {}
            try { if (progress) progress.close(); } catch (_) {}
            alert("Fehler beim Anlegen des neuen Dokuments:\n\n" + errText(e), SCRIPT_NAME);
        } finally {
            if (oldUnit !== null) {
                try { app.scriptPreferences.measurementUnit = oldUnit; } catch (_) {}
            }
        }
    }

    function buildReportFromDoc(doc, opt, progress, logFile) {
        var totalPages = doc.pages.length;
        var start = clamp(opt.startIndex, 0, Math.max(0, totalPages - 1));
        var end = clamp(opt.endIndex, start, Math.max(start, totalPages - 1));

        var report = {
            meta: {
                extractor: SCRIPT_NAME,
                version: SCRIPT_VERSION,
                build: BUILD,
                indesignVersion: safeStr(app.version),
                generatedAt: isoNow(),
                boundsOrder: ["top", "left", "bottom", "right"],
                units: "pt + mm",
                mode: "LITE+ / geometry + parent-page typography + sections/page numbering + create-document writer"
            },
            document: {
                name: safeStr(doc.name),
                pageCount: totalPages,
                facingPages: safeBool(getProp(doc.documentPreferences, "facingPages")),
                pageWidth: measure(getProp(doc.documentPreferences, "pageWidth")),
                pageHeight: measure(getProp(doc.documentPreferences, "pageHeight"))
            },
            selection: {
                startPhysicalPage: start + 1,
                endPhysicalPage: end + 1,
                count: end - start + 1,
                startPageName: safeStr(getProp(doc.pages[start], "name")),
                endPageName: safeStr(getProp(doc.pages[end], "name"))
            },
            sections: [],
            parentPages: [],
            pages: [],
            warnings: []
        };

        var usedMasters = [];
        var masterKeys = {};
        var pageCount = end - start + 1;
        var i;

        if (opt.includeSections) {
            if (progress) setProgress(progress, 5, "Abschnitte / Seitennummerierung …");
            if (logFile) logLine(logFile, "SECTION scan begin count=" + safeLength(getProp(doc, "sections")));
            report.sections = scanSections(doc, start, end, report.warnings);
            if (logFile) logLine(logFile, "SECTION scan end exported=" + report.sections.length);
        }

        if (logFile) logLine(logFile, "Selected pages: " + (start + 1) + ".." + (end + 1));
        if (progress) setProgress(progress, 8, "Ausgewählte Seiten …");

        for (i = start; i <= end; i++) {
            var page = doc.pages[i];
            if (logFile) logLine(logFile, "PAGE begin physical=" + (i + 1) + " name=" + safeStr(getProp(page, "name")));
            report.pages.push(scanPage(page, i + 1, false, opt, report.warnings));

            if (opt.includeMasters) {
                var m = getProp(page, "appliedMaster");
                addMasterUnique(m, usedMasters, masterKeys);
                if (opt.includeBasedOnMasters) addMasterChain(m, usedMasters, masterKeys);
            }

            if (logFile) logLine(logFile, "PAGE end physical=" + (i + 1));
            if (progress) {
                setProgress(progress, 8 + Math.round(((i - start + 1) / pageCount) * 55),
                    "Seite " + (i + 1) + "/" + totalPages + "  ·  " + safeStr(getProp(page, "name")));
            }
        }

        if (opt.includeMasters) {
            if (progress) setProgress(progress, 67, "Verwendete Muster-/Elternseiten …");
            if (logFile) logLine(logFile, "MASTER count=" + usedMasters.length);
            for (i = 0; i < usedMasters.length; i++) {
                var ms = usedMasters[i];
                if (!ms || !isValidObj(ms)) continue;
                if (logFile) logLine(logFile, "MASTER begin " + safeStr(getProp(ms, "name")));
                report.parentPages.push(scanMaster(ms, opt, report.warnings));
                if (logFile) logLine(logFile, "MASTER end " + safeStr(getProp(ms, "name")));
                if (progress) {
                    setProgress(progress, 67 + Math.round(((i + 1) / Math.max(1, usedMasters.length)) * 18),
                        "Muster/Eltern: " + safeStr(getProp(ms, "name")));
                }
            }
        }
        return report;
    }

    function createDocumentFromReport(report, opt, progress, logFile) {
        if (!report || !report.document || !report.pages) throw new Error("Layout-Report ist unvollständig.");
        var pageCount = Math.max(1, safeLength(report.pages));
        var facing = !!(report.document && report.document.facingPages);
        var pageWidth = report.document.pageWidth && report.document.pageWidth.pt ? report.document.pageWidth.pt : 419.527559;
        var pageHeight = report.document.pageHeight && report.document.pageHeight.pt ? report.document.pageHeight.pt : 595.275591;

        var nd = app.documents.add();
        try { nd.documentPreferences.facingPages = facing; } catch (_) {}
        if (opt.createIncludeDocPrefs) {
            try { nd.documentPreferences.pageWidth = pageWidth; } catch (_) {}
            try { nd.documentPreferences.pageHeight = pageHeight; } catch (_) {}
        }

        ensurePageCount(nd, pageCount);
        if (progress) setProgress(progress, 28, "Muster-/Elternseiten …");

        var masterMap = {};
        if (opt.createIncludeMasters) {
            createParentPagesFromReport(nd, report, masterMap, opt, progress, logFile);
        }

        if (progress) setProgress(progress, 58, "Dokumentseiten aufbauen …");
        createDocumentPagesFromReport(nd, report, masterMap, opt, progress, logFile);

        if (opt.createIncludeSections) {
            if (progress) setProgress(progress, 86, "Abschnitte anwenden …");
            applySectionsFromReport(nd, report, logFile);
        }

        return nd;
    }

    function createParentPagesFromReport(nd, report, masterMap, opt, progress, logFile) {
        var parents = report.parentPages || [];
        var i, j;
        if (!parents.length) return;

        for (i = 0; i < parents.length; i++) {
            var pd = parents[i];
            var ms = (i === 0 && nd.masterSpreads.length > 0) ? nd.masterSpreads[0] : nd.masterSpreads.add();
            configureMasterSpread(ms, pd);
            masterMap[masterDataKey(pd)] = ms;
            masterMap["name:" + safeStr(pd.name)] = ms;
        }

        for (i = 0; i < parents.length; i++) {
            var pda = parents[i];
            var msa = masterMap[masterDataKey(pda)] || masterMap["name:" + safeStr(pda.name)];
            if (!msa) continue;
            syncPagesCount(msa, safeLength(pda.pages));
            for (j = 0; j < safeLength(pda.pages); j++) {
                var p = msa.pages[j];
                var pageData = pda.pages[j];
                clearPageItems(p);
                applyMarginsToPage(p, pageData.margins);
                recreateFramesOnPage(p, pageData.frames || [], nd, true, opt, progress, 28, 54);
            }
        }

        for (i = 0; i < parents.length; i++) {
            try {
                var child = masterMap[masterDataKey(parents[i])] || masterMap["name:" + safeStr(parents[i].name)];
                var based = parents[i].basedOn;
                if (child && based) {
                    var baseMs = masterMap["id:" + based.id] || masterMap["name:" + safeStr(based.name)];
                    if (baseMs) child.appliedMaster = baseMs;
                }
            } catch (_) {}
        }
    }

    function createDocumentPagesFromReport(nd, report, masterMap, opt, progress, logFile) {
        var i;
        for (i = 0; i < safeLength(report.pages); i++) {
            var pageData = report.pages[i];
            var p = nd.pages[i];
            applyMarginsToPage(p, pageData.margins);
            if (opt.createIncludeMasters && pageData.appliedMaster) {
                var ms = masterMap["id:" + pageData.appliedMaster.id] || masterMap["name:" + safeStr(pageData.appliedMaster.name)];
                try { if (ms) p.appliedMaster = ms; } catch (_) {}
            }
            if (opt.createIncludeMasters) {
                recreateFramesOnPage(p, pageData.frames || [], nd, false, opt, progress, 58, 84, i, safeLength(report.pages));
            }
        }
    }

    function applySectionsFromReport(nd, report, logFile) {
        var selStart = report.selection && report.selection.startPhysicalPage ? report.selection.startPhysicalPage : 1;
        var selEnd = report.selection && report.selection.endPhysicalPage ? report.selection.endPhysicalPage : safeLength(report.pages);
        var sections = report.sections || [];
        var i;
        for (i = safeLength(nd.sections) - 1; i >= 1; i--) {
            try { nd.sections[i].remove(); } catch (_) {}
        }

        var firstDone = false;
        for (i = 0; i < safeLength(sections); i++) {
            var s = sections[i];
            if (s.intersectsSelectedPageRange === false) continue;
            if (s.startPhysicalPage === null) continue;
            var startPhys = Math.max(s.startPhysicalPage, selStart);
            var newIndex = startPhys - selStart;
            if (newIndex < 0 || newIndex >= nd.pages.length) continue;
            var page = nd.pages[newIndex];
            var sec = null;
            if (!firstDone && newIndex === 0) {
                try { sec = page.appliedSection; } catch (_) {}
                if (!sec) {
                    try { sec = nd.sections[0]; } catch (_) {}
                }
                firstDone = true;
            } else {
                try { sec = nd.sections.add(page); } catch (_) {
                    try { sec = nd.sections.add(page, LocationOptions.AT_END); } catch (_) {}
                }
            }
            if (!sec) continue;
            try { sec.continueNumbering = !!s.continueNumbering; } catch (_) {}
            try {
                var startVal = s.pageNumberStartEffective !== null && s.pageNumberStartEffective !== undefined ? s.pageNumberStartEffective : s.pageNumberStartConfigured;
                if (!s.continueNumbering && startVal !== null && startVal !== undefined) sec.pageNumberStart = startVal;
            } catch (_) {}
            try { if (s.pageNumberStyle && s.pageNumberStyle.raw !== null) sec.pageNumberStyle = s.pageNumberStyle.raw; } catch (_) {}
            try { if (s.sectionPrefix !== null) sec.sectionPrefix = s.sectionPrefix; } catch (_) {}
            try { if (s.includeSectionPrefix !== null) sec.includeSectionPrefix = !!s.includeSectionPrefix; } catch (_) {}
            try { if (s.marker !== null) sec.marker = s.marker; } catch (_) {}
            if (logFile) logLine(logFile, "SECTION apply startPage=" + (newIndex + 1) + " style=" + (s.pageNumberStyle ? s.pageNumberStyle.name : ""));
        }
    }

    function configureMasterSpread(ms, data) {
        if (!ms || !data) return;
        try { if (data.name) ms.name = data.name; } catch (_) {}
        try { if (data.prefix) ms.namePrefix = data.prefix; } catch (_) {}
        try {
            if (data.name && ms.baseName !== undefined) {
                var bn = data.name;
                var pos = bn.indexOf('-');
                if (pos >= 0 && pos < bn.length - 1) bn = bn.substring(pos + 1);
                ms.baseName = bn;
            }
        } catch (_) {}
    }

    function masterDataKey(data) {
        if (!data) return null;
        if (data.id !== null && data.id !== undefined) return "id:" + data.id;
        return "name:" + safeStr(data.name);
    }

    function ensurePageCount(doc, count) {
        var i;
        while (doc.pages.length < count) doc.pages.add();
        while (doc.pages.length > count) {
            try { doc.pages[doc.pages.length - 1].remove(); } catch (_) { break; }
        }
    }

    function syncPagesCount(spread, count) {
        var i;
        if (!spread || !spread.pages) return;
        while (spread.pages.length < count) {
            try { spread.pages.add(); } catch (_) { break; }
        }
        while (spread.pages.length > count) {
            try { spread.pages[spread.pages.length - 1].remove(); } catch (_) { break; }
        }
    }

    function clearPageItems(page) {
        var items = getProp(page, "pageItems");
        if (!items) return;
        var i;
        for (i = safeLength(items) - 1; i >= 0; i--) {
            try { items[i].remove(); } catch (_) {}
        }
    }

    function recreateFramesOnPage(page, frames, doc, isMaster, opt, progress, pStart, pEnd, pageIndex, totalPages) {
        var i;
        for (i = 0; i < safeLength(frames); i++) {
            createFrameOnPage(page, frames[i], doc, isMaster, opt);
        }
        if (progress && pageIndex !== undefined && totalPages) {
            var pct = pStart + Math.round(((pageIndex + 1) / Math.max(1, totalPages)) * (pEnd - pStart));
            setProgress(progress, pct, "Dokumentseite rekonstruieren " + (pageIndex + 1) + "/" + totalPages);
        }
    }

    function createFrameOnPage(page, frameData, doc, isMaster, opt) {
        if (!frameData || !page) return null;
        var type = safeStr(frameData.type);
        var item = null;
        try {
            if (type === "TextFrame") item = page.textFrames.add();
            else if (type === "Rectangle") item = page.rectangles.add();
            else if (type === "GraphicLine") item = page.graphicLines.add();
            else if (type === "Group") item = page.rectangles.add();
            else return null;
        } catch (_) { return null; }

        applyCommonItemProps(item, frameData, doc, page);

        if (type === "TextFrame") {
            applyTextFrameProps(item, frameData, doc, isMaster, opt);
        }
        return item;
    }

    function applyCommonItemProps(item, frameData, doc, page) {
        if (!item || !frameData) return;
        var gb = absoluteBoundsFromData(frameData, page);
        try { if (gb) item.geometricBounds = gb; } catch (_) {}
        try { if (frameData.name) item.name = frameData.name; } catch (_) {}
        try { if (frameData.label) item.label = frameData.label; } catch (_) {}
        try { if (frameData.rotationAngle !== null && frameData.rotationAngle !== undefined) item.rotationAngle = frameData.rotationAngle; } catch (_) {}
        try { if (frameData.strokeWeight && frameData.strokeWeight.pt !== null) item.strokeWeight = frameData.strokeWeight.pt; } catch (_) {}
        applySwatchProp(item, "fillColor", frameData.fillColor, doc);
        applySwatchProp(item, "strokeColor", frameData.strokeColor, doc);
        try {
            if (frameData.objectStyle && frameData.objectStyle !== "[None]") {
                var os = doc.objectStyles.itemByName(frameData.objectStyle);
                if (os && os.isValid) item.appliedObjectStyle = os;
            }
        } catch (_) {}
    }

    function applyTextFrameProps(tf, frameData, doc, isMaster, opt) {
        var tfd = frameData.textFrame || {};
        try { if (tfd.columns !== null && tfd.columns !== undefined) tf.textFramePreferences.textColumnCount = tfd.columns; } catch (_) {}
        try { if (tfd.columnGutter && tfd.columnGutter.pt !== null) tf.textFramePreferences.textColumnGutter = tfd.columnGutter.pt; } catch (_) {}
        try {
            if (tfd.insetSpacing && tfd.insetSpacing.length === 4) {
                tf.textFramePreferences.insetSpacing = [
                    tfd.insetSpacing[0].pt || 0,
                    tfd.insetSpacing[1].pt || 0,
                    tfd.insetSpacing[2].pt || 0,
                    tfd.insetSpacing[3].pt || 0
                ];
            }
        } catch (_) {}
        try { setEnumProp(tf.textFramePreferences, "verticalJustification", tfd.verticalJustification, verticalJustificationEnum); } catch (_) {}
        try { setEnumProp(tf.textFramePreferences, "firstBaselineOffset", tfd.firstBaselineOffset, firstBaselineEnum); } catch (_) {}
        try { setEnumProp(tf.textFramePreferences, "autoSizingType", tfd.autoSizingType, autoSizingTypeEnum); } catch (_) {}

        var preview = tfd.masterTextPreview;
        if (isMaster && preview !== null && preview !== undefined && preview !== "") {
            try {
                if (preview === "[AUTO_PAGE_NUMBER]") tf.insertionPoints[0].contents = SpecialCharacters.AUTO_PAGE_NUMBER;
                else tf.contents = preview;
            } catch (_) {}
        }

        if (isMaster && opt.createIncludeMasterTypography && tfd.masterTypography) {
            applyTypographyToTextFrame(tf, tfd.masterTypography, doc);
        }
    }

    function applyTypographyToTextFrame(tf, ty, doc) {
        if (!tf || !ty) return;
        var ip = null;
        try { ip = tf.insertionPoints[0]; } catch (_) {}
        if (!ip) return;

        var paraTarget = null;
        try { paraTarget = tf.paragraphs.length ? tf.paragraphs[0] : ip; } catch (_) { paraTarget = ip; }
        var charTarget = null;
        try { charTarget = tf.characters.length ? tf.characters[0] : ip; } catch (_) { charTarget = ip; }

        var p = ty.paragraph || null;
        var c = ty.character || null;
        if (p) {
            try {
                if (p.appliedParagraphStyle && p.appliedParagraphStyle !== "[Basic Paragraph]") {
                    var ps = doc.paragraphStyles.itemByName(p.appliedParagraphStyle);
                    if (ps && ps.isValid) paraTarget.appliedParagraphStyle = ps;
                }
            } catch (_) {}
            setEnumProp(paraTarget, "justification", p.justification, justificationEnum);
            try { if (p.leftIndent && p.leftIndent.pt !== null) paraTarget.leftIndent = p.leftIndent.pt; } catch (_) {}
            try { if (p.rightIndent && p.rightIndent.pt !== null) paraTarget.rightIndent = p.rightIndent.pt; } catch (_) {}
            try { if (p.firstLineIndent && p.firstLineIndent.pt !== null) paraTarget.firstLineIndent = p.firstLineIndent.pt; } catch (_) {}
            try { if (p.spaceBefore && p.spaceBefore.pt !== null) paraTarget.spaceBefore = p.spaceBefore.pt; } catch (_) {}
            try { if (p.spaceAfter && p.spaceAfter.pt !== null) paraTarget.spaceAfter = p.spaceAfter.pt; } catch (_) {}
            try { if (p.hyphenation !== null && p.hyphenation !== undefined) paraTarget.hyphenation = !!p.hyphenation; } catch (_) {}
            try { if (p.keepWithNext !== null && p.keepWithNext !== undefined) paraTarget.keepWithNext = p.keepWithNext; } catch (_) {}
            try { if (p.keepAllLinesTogether !== null && p.keepAllLinesTogether !== undefined) paraTarget.keepAllLinesTogether = !!p.keepAllLinesTogether; } catch (_) {}
        }

        if (c) {
            try {
                if (c.appliedCharacterStyle && c.appliedCharacterStyle !== "[None]") {
                    var cs = doc.characterStyles.itemByName(c.appliedCharacterStyle);
                    if (cs && cs.isValid) charTarget.appliedCharacterStyle = cs;
                }
            } catch (_) {}
            try { if (c.appliedFont) charTarget.appliedFont = c.appliedFont; } catch (_) {}
            try { if (c.fontStyle) charTarget.fontStyle = c.fontStyle; } catch (_) {}
            try { if (c.pointSize && c.pointSize.value !== null) charTarget.pointSize = c.pointSize.value; } catch (_) {}
            try {
                if (c.leading) {
                    if (c.leading.value === "AUTO") {
                        charTarget.leading = Leading.AUTO;
                        if (c.leading.autoLeadingPercent !== null && c.leading.autoLeadingPercent !== undefined) charTarget.autoLeading = c.leading.autoLeadingPercent;
                    } else if (c.leading.value !== null && c.leading.value !== undefined) {
                        charTarget.leading = c.leading.value;
                    }
                }
            } catch (_) {}
            applySwatchProp(charTarget, "fillColor", c.fillColor, doc);
            applySwatchProp(charTarget, "strokeColor", c.strokeColor, doc);
            try { if (c.tracking !== null && c.tracking !== undefined) charTarget.tracking = c.tracking; } catch (_) {}
            try { if (c.horizontalScale !== null && c.horizontalScale !== undefined) charTarget.horizontalScale = c.horizontalScale; } catch (_) {}
            try { if (c.verticalScale !== null && c.verticalScale !== undefined) charTarget.verticalScale = c.verticalScale; } catch (_) {}
            try { if (c.baselineShift && c.baselineShift.value !== null) charTarget.baselineShift = c.baselineShift.value; } catch (_) {}
            try { if (c.capitalization) setEnumProp(charTarget, "capitalization", c.capitalization, capitalizationEnum); } catch (_) {}
            try { if (c.position) setEnumProp(charTarget, "position", c.position, positionEnum); } catch (_) {}
            try { if (c.language) charTarget.appliedLanguage = c.language; } catch (_) {}
        }
    }

    function absoluteBoundsFromData(frameData, page) {
        var rel = frameData.pageRelativeBounds || null;
        if (rel && page && page.bounds && page.bounds.length >= 4) {
            var pb = page.bounds;
            return [
                rel.topPt + pb[0],
                rel.leftPt + pb[1],
                rel.bottomPt + pb[0],
                rel.rightPt + pb[1]
            ];
        }
        var b = frameData.bounds;
        if (b) return [b.topPt, b.leftPt, b.bottomPt, b.rightPt];
        return null;
    }

    function applyMarginsToPage(page, margins) {
        if (!page || !margins) return;
        try { if (margins.top && margins.top.pt !== null) page.marginPreferences.top = margins.top.pt; } catch (_) {}
        try { if (margins.bottom && margins.bottom.pt !== null) page.marginPreferences.bottom = margins.bottom.pt; } catch (_) {}
        try { if (margins.left && margins.left.pt !== null) page.marginPreferences.left = margins.left.pt; } catch (_) {}
        try { if (margins.right && margins.right.pt !== null) page.marginPreferences.right = margins.right.pt; } catch (_) {}
        try { if (margins.columnCount !== null && margins.columnCount !== undefined) page.marginPreferences.columnCount = margins.columnCount; } catch (_) {}
        try { if (margins.columnGutter && margins.columnGutter.pt !== null) page.marginPreferences.columnGutter = margins.columnGutter.pt; } catch (_) {}
    }

    function applySwatchProp(obj, prop, name, doc) {
        if (!obj || !name || !doc) return;
        try {
            if (name === "None" || name === "[None]") obj[prop] = doc.swatches.itemByName("None");
            else obj[prop] = doc.swatches.itemByName(name);
        } catch (_) {}
    }

    function setEnumProp(obj, prop, strName, mapFn) {
        if (!obj || !strName || !mapFn) return;
        var v = mapFn(strName);
        if (v === null || v === undefined) return;
        try { obj[prop] = v; } catch (_) {}
    }

    function justificationEnum(s) {
        if (!s) return null;
        if (s === "LEFT_ALIGN") return Justification.LEFT_ALIGN;
        if (s === "RIGHT_ALIGN") return Justification.RIGHT_ALIGN;
        if (s === "CENTER_ALIGN") return Justification.CENTER_ALIGN;
        if (s === "LEFT_JUSTIFIED") return Justification.LEFT_JUSTIFIED;
        if (s === "RIGHT_JUSTIFIED") return Justification.RIGHT_JUSTIFIED;
        if (s === "CENTER_JUSTIFIED") return Justification.CENTER_JUSTIFIED;
        if (s === "FULLY_JUSTIFIED") return Justification.FULLY_JUSTIFIED;
        if (s === "TO_BINDING_SIDE") return Justification.TO_BINDING_SIDE;
        if (s === "AWAY_FROM_BINDING_SIDE") return Justification.AWAY_FROM_BINDING_SIDE;
        return null;
    }

    function verticalJustificationEnum(s) {
        if (!s) return null;
        if (s === "TOP_ALIGN") return VerticalJustification.TOP_ALIGN;
        if (s === "CENTER_ALIGN") return VerticalJustification.CENTER_ALIGN;
        if (s === "BOTTOM_ALIGN") return VerticalJustification.BOTTOM_ALIGN;
        if (s === "JUSTIFY_ALIGN") return VerticalJustification.JUSTIFY_ALIGN;
        return null;
    }

    function firstBaselineEnum(s) {
        if (!s) return null;
        if (s === "ASCENT_OFFSET") return FirstBaseline.ASCENT_OFFSET;
        if (s === "CAP_HEIGHT") return FirstBaseline.CAP_HEIGHT;
        if (s === "LEADING_OFFSET") return FirstBaseline.LEADING_OFFSET;
        if (s === "EMBOX_HEIGHT") return FirstBaseline.EMBOX_HEIGHT;
        if (s === "X_HEIGHT") return FirstBaseline.X_HEIGHT;
        if (s === "FIXED_HEIGHT") return FirstBaseline.FIXED_HEIGHT;
        return null;
    }

    function autoSizingTypeEnum(s) {
        if (!s) return null;
        if (s === "OFF") return AutoSizingTypeEnum.OFF;
        if (s === "HEIGHT_ONLY") return AutoSizingTypeEnum.HEIGHT_ONLY;
        if (s === "WIDTH_ONLY") return AutoSizingTypeEnum.WIDTH_ONLY;
        if (s === "HEIGHT_AND_WIDTH") return AutoSizingTypeEnum.HEIGHT_AND_WIDTH;
        if (s === "HEIGHT_AND_WIDTH_PROPORTIONALLY") return AutoSizingTypeEnum.HEIGHT_AND_WIDTH_PROPORTIONALLY;
        return null;
    }

    function capitalizationEnum(s) {
        if (!s) return null;
        if (s === "NORMAL") return Capitalization.NORMAL;
        if (s === "ALL_CAPS") return Capitalization.ALL_CAPS;
        if (s === "SMALL_CAPS") return Capitalization.SMALL_CAPS;
        if (s === "CAP_TO_SMALL_CAP") return Capitalization.CAP_TO_SMALL_CAP;
        return null;
    }

    function positionEnum(s) {
        if (!s) return null;
        if (s === "NORMAL") return Position.NORMAL;
        if (s === "SUPERSCRIPT") return Position.SUPERSCRIPT;
        if (s === "SUBSCRIPT") return Position.SUBSCRIPT;
        if (s === "OT_SUPERSCRIPT") return Position.OT_SUPERSCRIPT;
        if (s === "OT_SUBSCRIPT") return Position.OT_SUBSCRIPT;
        return null;
    }

    // ---------------- Consolidated Text Tools ----------------

    // ---------------- FAST Text Engine v2.5 ----------------
    // Deliberately separate from the legacy engine below.
    // No loops over characters or paragraphs are used here.

    function makeImportFastOptions18(importTypo,sourceText){
        var p=analyzeImportTextProfile18(String(sourceText||""),importTypo.textMode||"auto");
        return {
            engine:"direct",scope:0,skipShortStories:false,minStoryChars:0,
            latinFontFamily:importTypo.latinFontFamily,
            hebrewFontFamily:importTypo.hebrewFontFamily,
            baseSize:importTypo.baseSize,
            smallSize:importTypo.smallSize,
            bigSize:importTypo.bigSize,
            alignment:importTypo.alignment,
            leadingMode:importTypo.leadingMode,
            leadingValue:importTypo.leadingValue,
            autoLeadingPercent:importTypo.autoLeadingPercent,
            worldReady:importTypo.worldReady,
            resetStyles:true,clearOverrides:false,hebrewGrep:true,
            processHtml:importTypo.processHtml,
            stripTags:importTypo.stripTags,
            removeNikkud:false,removeDagesh:false,
            disableRedraw:true,recomposeOnce:true,
            importProfile:p,
            skipAbsentHtml:!!importTypo.skipAbsentHtml
        };
    }

    function analyzeImportTextProfile18(source,requestedMode){
        source=String(source||"");
        requestedMode=String(requestedMode||"auto");
        var maxSamples=80000,step=Math.max(1,Math.floor(source.length/maxSamples));
        var heb=0,lat=0,otherLetters=0,i,c,code;
        for(i=0;i<source.length;i+=step){
            code=source.charCodeAt(i);
            if((code>=0x0590&&code<=0x05FF)||(code>=0xFB1D&&code<=0xFB4F))heb++;
            else if((code>=65&&code<=90)||(code>=97&&code<=122))lat++;
            else if((code>=0x00C0&&code<=0x024F))lat++;
        }
        var letters=Math.max(1,heb+lat+otherLetters);
        var hr=heb/letters,lr=lat/letters,mode=requestedMode;
        if(mode==="auto"){
            if(heb>0 && (lat===0 || hr>=0.985))mode="hebrew";
            else if(lat>0 && (heb===0 || lr>=0.985))mode="latin";
            else mode="mixed";
        }
        var html=detectImportHtmlFlags18(source);
        return {mode:mode,hebrewRatio:hr,latinRatio:lr,hebrewSamples:heb,latinSamples:lat,html:html};
    }

    function detectImportHtmlFlags18(source){
        var low=String(source||"").toLowerCase(),f={};
        f.br=low.indexOf("<br")>=0;
        f.small=low.indexOf("<small>")>=0;
        f.big=low.indexOf("<big>")>=0;
        f.bold=low.indexOf("<b>")>=0;
        f.italic=low.indexOf("<i>")>=0;
        f.sup=low.indexOf("<sup>")>=0; // plain sup only; attributed footnote markers stay separate
        f.boldItalic=(low.indexOf("<b><i>")>=0||low.indexOf("<i><b>")>=0);
        f.any=!!(f.br||f.small||f.big||f.bold||f.italic||f.sup);
        var n=[];
        if(f.br)n.push("br");
        if(f.small)n.push("small");
        if(f.big)n.push("big");
        if(f.bold)n.push("b");
        if(f.italic)n.push("i");
        if(f.sup)n.push("sup");
        f.summary=n.length?n.join(","):"none";
        return f;
    }

    function importTextProfileLabel18(p){
        if(!p)return "unbekannt";
        if(p.mode==="hebrew")return "Hebräisch-TURBO";
        if(p.mode==="latin")return "Latein-TURBO";
        return "Gemischt-GREP";
    }

    function estimatedImportTypographyPasses18(p,htmlEnabled){
        if(!p)return "?";
        var n=1; // base paragraph style / base bulk apply
        if(p.mode==="mixed")n++; // one Hebrew family pass
        if(htmlEnabled&&p.html&&p.html.any){
            if(p.html.br)n++;
            if(p.html.small)n++;
            if(p.html.big)n++;
            if(p.html.sup)n++;
            if(p.html.bold)n++;
            if(p.html.italic)n++;
            if(p.html.boldItalic)n+=2;
            n++; // tag stripping
            if(p.mode==="mixed"&&(p.html.bold||p.html.italic))n+=9; // legacy style-normalization fallback
        }
        return String(n);
    }

    var FAST_HEBREW_GREP18 = "[\\x{0590}-\\x{05FF}\\x{FB1D}-\\x{FB4F}]+";
    var FAST_NIKKUD_GREP18 = "[\\x{0591}-\\x{05BD}\\x{05BF}\\x{05C1}\\x{05C2}\\x{05C4}\\x{05C5}\\x{05C7}]";

    function runFastTextWorkflow18(opt) {
        if (app.documents.length === 0) {
            alert("Kein InDesign-Dokument geöffnet.", SCRIPT_NAME);
            return;
        }
        var doc=app.activeDocument, targets, oldRedraw=true, startMs=(new Date()).getTime(), totalChars=0, i, report;
        try {
            targets=fastCollectTargets18(doc,opt);
            if(!targets.length) throw new Error("Im gewählten Bereich wurde kein geeigneter Text gefunden.");
            for(i=0;i<targets.length;i++) totalChars += fastTextLength18(targets[i].text);
            try { oldRedraw=app.scriptPreferences.enableRedraw; } catch (_) {}

            var work=function(){
                if(opt.disableRedraw) try { app.scriptPreferences.enableRedraw=false; } catch (_) {}
                try {
                    var live=null;
                    if(opt.engine==="liveStyle") live=fastEnsureLiveStyles18(doc,opt);
                    for(var ti=0;ti<targets.length;ti++) {
                        if(opt.engine==="liveStyle") fastFormatLiveTarget18(targets[ti].text,opt,live);
                        else fastFormatDirectTarget18(targets[ti].text,opt);
                    }
                } finally {
                    resetFindChange18();
                    if(opt.disableRedraw) try { app.scriptPreferences.enableRedraw=oldRedraw; } catch (_) {}
                }
            };
            fastRunUndoable18("FAST Keter/Cambria Typografie",work);
            try { app.scriptPreferences.enableRedraw=oldRedraw; } catch (_) {}
            var elapsed=((new Date()).getTime()-startMs)/1000;
            report="FAST-Formatierung abgeschlossen.\n\nEngine: "+(opt.engine==="liveStyle"?"Live-GREP-Stil":"Direkt-GREP")+
                   "\nBereiche/Stories: "+targets.length+"\nZeichen (ca.): "+totalChars+"\nZeit: "+elapsed.toFixed(2)+" s";
            if(opt.engine==="liveStyle") report += "\n\nErzeugt/aktualisiert: FAST · Body · Keter-Cambria + FAST · Hebräisch · Keter YG.";
            alert(report,SCRIPT_NAME);
        } catch(e) {
            try { app.scriptPreferences.enableRedraw=oldRedraw; } catch (_) {}
            resetFindChange18();
            alert("FAST-Formatierung fehlgeschlagen:\n\n"+errText(e),SCRIPT_NAME);
        }
    }

    function fastFormatProvidedText18(doc,txt,opt) {
        var oldRedraw=true, start=(new Date()).getTime();
        try { oldRedraw=app.scriptPreferences.enableRedraw; } catch (_) {}
        var work=function(){
            if(opt.disableRedraw) try { app.scriptPreferences.enableRedraw=false; } catch (_) {}
            try {
                if(opt.importProfile) fastFormatImportOptimized18(doc,txt,opt);
                else if(opt.engine==="liveStyle") fastFormatLiveTarget18(txt,opt,fastEnsureLiveStyles18(doc,opt));
                else fastFormatDirectTarget18(txt,opt);
            } finally {
                resetFindChange18();
                if(opt.disableRedraw) try { app.scriptPreferences.enableRedraw=oldRedraw; } catch (_) {}
            }
        };
        fastRunUndoable18("FAST importierten Haupttext formatieren",work);
        try { app.scriptPreferences.enableRedraw=oldRedraw; } catch (_) {}
        return ((new Date()).getTime()-start)/1000;
    }

    function fastRunUndoable18(name,fn) {
        var mode=UndoModes.ENTIRE_SCRIPT;
        try { if(UndoModes.FAST_ENTIRE_SCRIPT!==undefined) mode=UndoModes.FAST_ENTIRE_SCRIPT; } catch (_) {}
        app.doScript(fn,ScriptLanguage.JAVASCRIPT,undefined,mode,name);
    }

    function fastStoryText18(story) {
        try { if(story && story.isValid && story.texts && story.texts.length) return story.texts[0]; } catch (_) {}
        return null;
    }

    function fastTextLength18(txt) {
        try { return txt.characters.length; } catch (_) { return 0; }
    }

    function fastStoryLength18(story) {
        try { return story.characters.length; } catch (_) { return 0; }
    }

    function fastCurrentStory18() {
        if(!app.selection.length) return null;
        var sel=app.selection[0], t=null;
        try { if(sel.hasOwnProperty("texts") && sel.texts.length) t=sel.texts[0]; } catch (_) {}
        if(!t) try { if(sel.hasOwnProperty("parentStory")) return sel.parentStory; } catch (_) {}
        try { if(t && t.parentStory) return t.parentStory; } catch (_) {}
        return null;
    }

    function fastSelectedText18() {
        if(!app.selection.length) return null;
        var sel=app.selection[0];
        try { if(sel.hasOwnProperty("texts") && sel.texts.length && sel.texts[0].characters.length) return sel.texts[0]; } catch (_) {}
        try { if(sel.hasOwnProperty("contents") && String(sel.contents).length) return sel; } catch (_) {}
        return null;
    }

    function fastCollectTargets18(doc,opt) {
        var out=[],i,st,len,best=null,bestLen=-1,t;
        if(opt.scope===0) {
            t=fastSelectedText18(); if(!t) throw new Error("Bitte zuerst Text auswählen.");
            out.push({text:t,label:"Auswahl"}); return out;
        }
        if(opt.scope===1) {
            st=fastCurrentStory18(); if(!st) throw new Error("Bitte in den gewünschten Buchtext klicken oder Text darin markieren.");
            t=fastStoryText18(st); if(!t) throw new Error("Die aktuelle Story konnte nicht aufgelöst werden.");
            out.push({text:t,label:"Aktuelle Story"}); return out;
        }
        if(opt.scope===2) {
            for(i=0;i<doc.stories.length;i++) {
                st=doc.stories[i]; len=fastStoryLength18(st);
                if(len>bestLen) { bestLen=len; best=st; }
            }
            t=fastStoryText18(best); if(!t) throw new Error("Keine Story gefunden.");
            out.push({text:t,label:"Längste Story"}); return out;
        }
        for(i=0;i<doc.stories.length;i++) {
            st=doc.stories[i]; len=fastStoryLength18(st);
            if(opt.skipShortStories && len<opt.minStoryChars) continue;
            if(len<=0) continue;
            t=fastStoryText18(st); if(t) out.push({text:t,label:"Story "+(i+1)});
        }
        return out;
    }

    function fastDescribeScope18(doc,scopeIndex,minChars) {
        var i,st,len,best=0,count=0,eligible=0,current;
        for(i=0;i<doc.stories.length;i++) {
            st=doc.stories[i]; len=fastStoryLength18(st); count++;
            if(len>best) best=len;
            if(len>=Math.max(0,minChars||0)) eligible++;
        }
        if(scopeIndex===0) {
            var t=fastSelectedText18(); return t ? "Auswahl: ca. "+fastTextLength18(t)+" Zeichen." : "Keine Textauswahl.";
        }
        if(scopeIndex===1) {
            current=fastCurrentStory18(); return current ? "Aktuelle Story: ca. "+fastStoryLength18(current)+" Zeichen. Dokument: "+count+" Stories." : "Keine aktuelle Text-Story. Bitte in den Haupttext klicken.";
        }
        if(scopeIndex===2) return "Längste Story: ca. "+best+" Zeichen. Dokument: "+count+" Stories.";
        return "Dokument: "+count+" Stories; davon "+eligible+" ab Mindestlänge "+Math.max(0,minChars||0)+". Längste Story: ca. "+best+" Zeichen.";
    }

    function fastJustification18(name) {
        if(name==="left") return Justification.LEFT_ALIGN;
        if(name==="center") return Justification.CENTER_ALIGN;
        if(name==="right") return Justification.RIGHT_ALIGN;
        return Justification.LEFT_JUSTIFIED;
    }

    function fastResolveExactFont18(family,styles,fallback) {
        return toolResolveFont([family],styles,fallback||family);
    }

    function fastSetComposerBulk18(txt) {
        try { txt.composer="Adobe World-Ready Paragraph Composer"; return; } catch (_) {}
        try { txt.composer="$ID/HL Composer"; } catch (_) {}
    }

    function fastFontSet18(opt) {
        return {
            latinReg:fastResolveExactFont18(opt.latinFontFamily,["Regular","Roman","Book","Normal"],opt.latinFontFamily),
            latinBold:fastResolveExactFont18(opt.latinFontFamily,["Bold","Demi Bold","Semibold"],opt.latinFontFamily),
            latinItalic:fastResolveExactFont18(opt.latinFontFamily,["Italic","Oblique"],opt.latinFontFamily),
            latinBI:fastResolveExactFont18(opt.latinFontFamily,["Bold Italic","BoldItalic","Bold Oblique"],opt.latinFontFamily),
            hebBase:fastResolveExactFont18(opt.hebrewFontFamily,["Medium","Regular","Book","Normal"],opt.hebrewFontFamily),
            hebBold:fastResolveExactFont18(opt.hebrewFontFamily,["Bold","Demi Bold","Black","Semibold"],opt.hebrewFontFamily),
            hebItalic:fastResolveExactFont18(opt.hebrewFontFamily,["Italic","Medium Italic","Oblique"],opt.hebrewFontFamily),
            hebBI:fastResolveExactFont18(opt.hebrewFontFamily,["Bold Italic","BoldItalic","Demi Bold Italic","Bold Oblique"],opt.hebrewFontFamily)
        };
    }

    function fastApplyLeadingBulk18(target,opt){
        if(!target||!opt||!opt.leadingMode||opt.leadingMode==="unchanged")return;
        if(opt.leadingMode==="fixed"){
            try{target.leading=Number(opt.leadingValue);}catch(_){}
            return;
        }
        try{target.leading=Leading.AUTO;}catch(_){}
        try{target.autoLeading=Number(opt.autoLeadingPercent||120);}catch(_){}
    }

    function fastEnsureImportBaseParagraphStyle18(doc,opt,mode){
        var fs=fastFontSet18(opt);
        var name=mode==="hebrew"?"BB · Import · Hebräisch":"BB · Import · Latein";
        var ps=fastGetOrCreateParagraphStyle18(doc,name);
        if(!ps)throw new Error("Import-Absatzformat konnte nicht angelegt werden: "+name);
        try{ps.appliedFont=mode==="hebrew"?fs.hebBase:fs.latinReg;}catch(_){}
        try{ps.pointSize=opt.baseSize;}catch(_){}
        fastApplyLeadingBulk18(ps,opt);
        try{ps.justification=fastJustification18(opt.alignment);}catch(_){}
        if(opt.worldReady){
            try{ps.composer="Adobe World-Ready Paragraph Composer";}catch(_){try{ps.composer="$ID/HL Composer";}catch(__){}}
        }
        if(mode==="hebrew"){
            try{ps.paragraphDirection=ParagraphDirectionOptions.RIGHT_TO_LEFT_DIRECTION;}catch(_){}
        }
        return {style:ps,fonts:fs};
    }

    function fastFormatImportOptimized18(doc,txt,opt){
        var p=opt.importProfile||{mode:"mixed",html:{any:false}};
        var flags=p.html||{any:false};

        // PURE HEBREW / PURE LATIN:
        // one paragraph-style application replaces:
        // whole-story Cambria -> Hebrew GREP -> 9 Hebrew style scans.
        if(p.mode==="hebrew"||p.mode==="latin"){
            var base=fastEnsureImportBaseParagraphStyle18(doc,opt,p.mode);
            try{txt.applyParagraphStyle(base.style,true);}
            catch(_){try{txt.appliedParagraphStyle=base.style;}catch(__){}}

            if(opt.processHtml && (!opt.skipAbsentHtml || flags.any)){
                fastProcessHtmlSelective18(txt,opt,base.fonts,flags,p.mode);
            }
            if(opt.removeNikkud)fastGrepReplace18(txt,FAST_NIKKUD_GREP18,"");
            if(opt.removeDagesh)fastGrepReplace18(txt,"\\x{05BC}","");
            if(opt.recomposeOnce)try{txt.recompose();}catch(_){try{txt.parentStory.recompose();}catch(__){}}
            return;
        }

        // MIXED:
        // keep the proven family-GREP route, but do not scan non-existent HTML
        // and do not execute the nine font-style normalization scans unless
        // bold/italic markup can actually have created those styles.
        var fs=fastFontSet18(opt);
        try{txt.appliedFont=opt.resetStyles?fs.latinReg:opt.latinFontFamily;}catch(_){try{txt.appliedFont=fs.latinReg;}catch(__){}}
        try{txt.pointSize=opt.baseSize;}catch(_){}
        fastApplyLeadingBulk18(txt,opt);
        try{txt.justification=fastJustification18(opt.alignment);}catch(_){}
        if(opt.worldReady)fastSetComposerBulk18(txt);

        if(opt.processHtml && (!opt.skipAbsentHtml || flags.any)){
            fastProcessHtmlSelective18(txt,opt,fs,flags,"mixed");
        }
        if(opt.hebrewGrep){
            var needsStyleNormalize=!!(flags.bold||flags.italic);
            if(needsStyleNormalize){
                fastGrepFormat18(txt,FAST_HEBREW_GREP18,{appliedFont:opt.hebrewFontFamily});
                fastNormalizeHebrewFontStyles18(txt,fs);
            }else{
                // Exact Keter base face in ONE pass; no 9-style cleanup required.
                fastGrepFormat18(txt,FAST_HEBREW_GREP18,{appliedFont:fs.hebBase});
            }
        }
        if(opt.removeNikkud)fastGrepReplace18(txt,FAST_NIKKUD_GREP18,"");
        if(opt.removeDagesh)fastGrepReplace18(txt,"\\x{05BC}","");
        if(opt.recomposeOnce)try{txt.recompose();}catch(_){try{txt.parentStory.recompose();}catch(__){}}
    }

    function fastProcessHtmlSelective18(txt,opt,fs,flags,mode){
        flags=flags||{};
        if(flags.br)fastGrepReplace18(txt,"(?i)<br\\s*/?>","\\r");
        if(flags.small)fastGrepFormat18(txt,"(?s)(?<=<small>).*?(?=</small>)",{pointSize:opt.smallSize});
        if(flags.big)fastGrepFormat18(txt,"(?s)(?<=<big>).*?(?=</big>)",{pointSize:opt.bigSize});
        if(flags.sup)fastGrepFormat18(txt,"(?s)(?<=<sup>).*?(?=</sup>)",{position:Position.SUPERSCRIPT});

        if(mode==="hebrew"){
            if(flags.bold)fastGrepFormat18(txt,"(?s)(?<=<b>).*?(?=</b>)",{appliedFont:fs.hebBold});
            if(flags.italic)fastGrepFormat18(txt,"(?s)(?<=<i>).*?(?=</i>)",{appliedFont:fs.hebItalic});
            if(flags.boldItalic){
                fastGrepFormat18(txt,"(?s)(?<=<b><i>).*?(?=</i></b>)",{appliedFont:fs.hebBI});
                fastGrepFormat18(txt,"(?s)(?<=<i><b>).*?(?=</b></i>)",{appliedFont:fs.hebBI});
            }
        }else if(mode==="latin"){
            if(flags.bold)fastGrepFormat18(txt,"(?s)(?<=<b>).*?(?=</b>)",{appliedFont:fs.latinBold});
            if(flags.italic)fastGrepFormat18(txt,"(?s)(?<=<i>).*?(?=</i>)",{appliedFont:fs.latinItalic});
            if(flags.boldItalic){
                fastGrepFormat18(txt,"(?s)(?<=<b><i>).*?(?=</i></b>)",{appliedFont:fs.latinBI});
                fastGrepFormat18(txt,"(?s)(?<=<i><b>).*?(?=</b></i>)",{appliedFont:fs.latinBI});
            }
        }else{
            // Mixed mode preserves the old, proven order. The later Hebrew
            // normalization is only invoked if b/i are actually present.
            if(flags.bold)fastGrepFormat18(txt,"(?s)(?<=<b>).*?(?=</b>)",{appliedFont:fs.latinBold});
            if(flags.italic)fastGrepFormat18(txt,"(?s)(?<=<i>).*?(?=</i>)",{appliedFont:fs.latinItalic});
            if(flags.boldItalic){
                fastGrepFormat18(txt,"(?s)(?<=<b><i>).*?(?=</i></b>)",{appliedFont:fs.latinBI});
                fastGrepFormat18(txt,"(?s)(?<=<i><b>).*?(?=</b></i>)",{appliedFont:fs.latinBI});
            }
        }

        if(opt.stripTags){
            var names=[];
            if(flags.small)names.push("small");
            if(flags.big)names.push("big");
            if(flags.bold)names.push("b");
            if(flags.italic)names.push("i");
            if(names.length)fastGrepReplace18(txt,"(?i)</?(?:"+names.join("|")+")\\b[^>]*>","");
            if(flags.sup)fastGrepReplace18(txt,"(?i)</?sup\\s*>","");
        }
    }

    function fastFormatDirectTarget18(txt,opt) {
        var fs=fastFontSet18(opt);
        try { txt.appliedFont=opt.resetStyles?fs.latinReg:opt.latinFontFamily; } catch (_) { try { txt.appliedFont=fs.latinReg; } catch (__) {} }
        try { txt.pointSize=opt.baseSize; } catch (_) {}
        fastApplyLeadingBulk18(txt,opt);
        try { txt.justification=fastJustification18(opt.alignment); } catch (_) {}
        if(opt.worldReady) fastSetComposerBulk18(txt);

        // Tags are handled before the Hebrew-family pass. This lets <b>/<i>
        // establish the desired style name once; Hebrew is then switched to
        // Keter in one native pass without losing Bold/Italic information.
        if(opt.processHtml) fastProcessHtml18(txt,opt,fs,false);
        if(opt.hebrewGrep) {
            fastGrepFormat18(txt,FAST_HEBREW_GREP18,{appliedFont:opt.hebrewFontFamily});
            fastNormalizeHebrewFontStyles18(txt,fs);
        }
        if(opt.removeNikkud) fastGrepReplace18(txt,FAST_NIKKUD_GREP18,"");
        if(opt.removeDagesh) fastGrepReplace18(txt,"\\x{05BC}","");
        if(opt.recomposeOnce) try { txt.recompose(); } catch (_) { try { txt.parentStory.recompose(); } catch (__) {} }
    }

    function fastGetOrCreateParagraphStyle18(doc,name) {
        var st=null;
        try { st=doc.paragraphStyles.itemByName(name); if(st&&st.isValid) return st; } catch (_) {}
        try { return doc.paragraphStyles.add({name:name}); } catch (_) { return null; }
    }

    function fastEnsureLiveStyles18(doc,opt) {
        var cs=getOrCreateCharacterStyle18(doc,"FAST · Hebräisch · Keter YG");
        if(!cs) throw new Error("FAST-Hebräisch-Zeichenformat konnte nicht angelegt werden.");
        var liveFonts=fastFontSet18(opt);
        try { cs.appliedFont=liveFonts.hebBase; } catch (_) { try { cs.appliedFont=opt.hebrewFontFamily; } catch (__) {} }
        var ps=fastGetOrCreateParagraphStyle18(doc,"FAST · Body · Keter-Cambria");
        if(!ps) throw new Error("FAST-Absatzformat konnte nicht angelegt werden.");
        try { ps.appliedFont=opt.latinFontFamily; } catch (_) { try { ps.appliedFont=fastResolveExactFont18(opt.latinFontFamily,["Regular","Roman"],opt.latinFontFamily); } catch (__) {} }
        try { ps.pointSize=opt.baseSize; } catch (_) {}
        fastApplyLeadingBulk18(ps,opt);
        try { ps.justification=fastJustification18(opt.alignment); } catch (_) {}
        if(opt.worldReady) {
            try { ps.composer="Adobe World-Ready Paragraph Composer"; } catch (_) { try { ps.composer="$ID/HL Composer"; } catch (__) {} }
        }
        try { while(ps.nestedGrepStyles.length) ps.nestedGrepStyles[0].remove(); } catch (_) {}
        try { ps.nestedGrepStyles.add({grepExpression:FAST_HEBREW_GREP18,appliedCharacterStyle:cs}); }
        catch(e) { throw new Error("GREP-Stil für Hebräisch konnte nicht erzeugt werden: "+errText(e)); }
        return {paragraphStyle:ps,hebrewStyle:cs};
    }

    function fastFormatLiveTarget18(txt,opt,live) {
        try { txt.applyParagraphStyle(live.paragraphStyle,!!opt.clearOverrides); }
        catch (_) { try { txt.appliedParagraphStyle=live.paragraphStyle; } catch (__) {} }
        if(opt.processHtml) fastProcessHtml18(txt,opt,fastFontSet18(opt),true);
        if(opt.removeNikkud) fastGrepReplace18(txt,FAST_NIKKUD_GREP18,"");
        if(opt.removeDagesh) fastGrepReplace18(txt,"\\x{05BC}","");
        if(opt.recomposeOnce) try { txt.recompose(); } catch (_) { try { txt.parentStory.recompose(); } catch (__) {} }
    }

    function fastGrepFormat18(txt,grep,props) {
        resetFindChange18();
        try {
            app.findGrepPreferences.findWhat=grep;
            if(props.appliedFont!==undefined) app.changeGrepPreferences.appliedFont=props.appliedFont;
            if(props.pointSize!==undefined) app.changeGrepPreferences.pointSize=props.pointSize;
            if(props.fontStyle!==undefined) app.changeGrepPreferences.fontStyle=props.fontStyle;
            if(props.appliedCharacterStyle!==undefined) app.changeGrepPreferences.appliedCharacterStyle=props.appliedCharacterStyle;
            if(props.position!==undefined) app.changeGrepPreferences.position=props.position;
            txt.changeGrep(false);
        } finally { resetFindChange18(); }
    }

    function fastGrepFormatByStyle18(txt,grep,findStyle,props) {
        resetFindChange18();
        try {
            app.findGrepPreferences.findWhat=grep;
            app.findGrepPreferences.fontStyle=findStyle;
            if(props.appliedFont!==undefined) app.changeGrepPreferences.appliedFont=props.appliedFont;
            if(props.fontStyle!==undefined) app.changeGrepPreferences.fontStyle=props.fontStyle;
            txt.changeGrep(false);
        } catch (_) {
            // A font may not expose this style name; skipping one mapping is
            // preferable to falling back to character-by-character work.
        } finally { resetFindChange18(); }
    }

    function fastNormalizeHebrewFontStyles18(txt,fs) {
        // All native GREP passes. Map common source style names to the exact
        // installed Keter variants resolved above.
        fastGrepFormatByStyle18(txt,FAST_HEBREW_GREP18,"Regular",{appliedFont:fs.hebBase});
        fastGrepFormatByStyle18(txt,FAST_HEBREW_GREP18,"Roman",{appliedFont:fs.hebBase});
        fastGrepFormatByStyle18(txt,FAST_HEBREW_GREP18,"Medium",{appliedFont:fs.hebBase});
        fastGrepFormatByStyle18(txt,FAST_HEBREW_GREP18,"Bold",{appliedFont:fs.hebBold});
        fastGrepFormatByStyle18(txt,FAST_HEBREW_GREP18,"Demi Bold",{appliedFont:fs.hebBold});
        fastGrepFormatByStyle18(txt,FAST_HEBREW_GREP18,"Italic",{appliedFont:fs.hebItalic});
        fastGrepFormatByStyle18(txt,FAST_HEBREW_GREP18,"Oblique",{appliedFont:fs.hebItalic});
        fastGrepFormatByStyle18(txt,FAST_HEBREW_GREP18,"Bold Italic",{appliedFont:fs.hebBI});
        fastGrepFormatByStyle18(txt,FAST_HEBREW_GREP18,"BoldItalic",{appliedFont:fs.hebBI});
    }

    function fastGrepReplace18(txt,grep,replacement) {
        resetFindChange18();
        try {
            app.findGrepPreferences.findWhat=grep;
            app.changeGrepPreferences.changeTo=replacement;
            txt.changeGrep(false);
        } finally { resetFindChange18(); }
    }

    function fastProcessHtml18(txt,opt,fs,liveMode) {
        // All passes are native InDesign GREP; no result arrays and no per-hit JS loops.
        fastGrepReplace18(txt,"(?i)<br\\s*/?>","\\r");
        fastGrepFormat18(txt,"(?s)(?<=<small>).*?(?=</small>)",{pointSize:opt.smallSize});
        fastGrepFormat18(txt,"(?s)(?<=<big>).*?(?=</big>)",{pointSize:opt.bigSize});
        fastGrepFormat18(txt,"(?s)(?<=<sup>).*?(?=</sup>)",{position:Position.SUPERSCRIPT});
        if(liveMode) {
            // In Live-GREP mode the Hebrew family comes from the GREP style,
            // so only the style attribute is overridden here.
            fastGrepFormat18(txt,"(?s)(?<=<b>).*?(?=</b>)",{fontStyle:"Bold"});
            fastGrepFormat18(txt,"(?s)(?<=<i>).*?(?=</i>)",{fontStyle:"Italic"});
            fastGrepFormat18(txt,"(?s)(?<=<b><i>).*?(?=</i></b>)",{fontStyle:"Bold Italic"});
            fastGrepFormat18(txt,"(?s)(?<=<i><b>).*?(?=</b></i>)",{fontStyle:"Bold Italic"});
        } else {
            // In direct mode exact Cambria variants are used first. The later
            // Hebrew-family pass converts only Hebrew runs to the matching Keter variant.
            fastGrepFormat18(txt,"(?s)(?<=<b>).*?(?=</b>)",{appliedFont:fs.latinBold});
            fastGrepFormat18(txt,"(?s)(?<=<i>).*?(?=</i>)",{appliedFont:fs.latinItalic});
            fastGrepFormat18(txt,"(?s)(?<=<b><i>).*?(?=</i></b>)",{appliedFont:fs.latinBI});
            fastGrepFormat18(txt,"(?s)(?<=<i><b>).*?(?=</b></i>)",{appliedFont:fs.latinBI});
        }
        if(opt.stripTags) {
            fastGrepReplace18(txt,"(?i)</?(?:small|big|b|i)\\b[^>]*>","");
            fastGrepReplace18(txt,"(?i)</?sup\\s*>","");
        }
    }

    function runTextToolsWorkflow(opt) {
        if (app.documents.length === 0) {
            alert("Kein InDesign-Dokument geöffnet.", SCRIPT_NAME);
            return;
        }
        try {
            if (opt.tool === "unicode" && opt.unicodeScope === "document") {
                runUndoable("Unicode-Escapes decodieren", function () { decodeUnicodeEscapesInDocument(app.activeDocument); });
                alert("Unicode-Escapes im aktiven Dokument wurden umgewandelt.", SCRIPT_NAME);
                return;
            }

            var txt = getSelectedTextForTools();
            if (!txt) return;

            if (opt.tool === "format") {
                runUndoable("Keter/Cambria Typografie", function () { applyTypographyPreset(txt, opt); });
                alert("Typografie/Tags wurden angewendet.", SCRIPT_NAME);
            } else if (opt.tool === "nikkud") {
                runUndoable("Hebräische Punktation entfernen", function () { removeHebrewMarksFromText(txt); });
                alert("Nikkud und Teamim wurden entfernt; hebräische Satzzeichen bleiben erhalten.", SCRIPT_NAME);
            } else if (opt.tool === "dagesh") {
                runUndoable("Dagesch entfernen", function () { removeDageshFromText(txt); });
                alert("Dagesch (U+05BC) wurde entfernt.", SCRIPT_NAME);
            } else if (opt.tool === "shin") {
                runUndoable("Shin-Präsentationsform normalisieren", function () { normalizeShinPresentationForm(txt); });
                alert("U+FB2A wurde als ש + Shin-Punkt normalisiert.", SCRIPT_NAME);
            } else if (opt.tool === "transliteration") {
                runUndoable("Hebräisch transliterieren", function () { appendSimpleTransliteration(txt, opt.translitFont, opt.translitSize); });
                alert("Transkription wurde hinter der Auswahl eingefügt.", SCRIPT_NAME);
            } else if (opt.tool === "unicode") {
                runUndoable("Unicode-Escapes decodieren", function () { decodeUnicodeEscapesInText(txt); });
                alert("Unicode-Escapes in der Auswahl wurden umgewandelt.", SCRIPT_NAME);
            }
        } catch (e) {
            resetFindChange18();
            alert("Text-Werkzeug fehlgeschlagen:\n\n" + errText(e), SCRIPT_NAME);
        } finally {
            resetFindChange18();
        }
    }

    function runUndoable(name, fn) {
        // InDesign 18.1 supports doScript with ENTIRE_SCRIPT; do not rerun on errors,
        // otherwise a partially executed destructive action could run twice.
        app.doScript(fn, ScriptLanguage.JAVASCRIPT, undefined, UndoModes.ENTIRE_SCRIPT, name);
    }

    function getSelectedTextForTools() {
        if (app.selection.length === 0) {
            alert("Bitte zuerst einen Textbereich auswählen.", SCRIPT_NAME);
            return null;
        }
        var sel = app.selection[0];
        try {
            if (sel.hasOwnProperty("texts") && sel.texts.length > 0) {
                var t = sel.texts[0];
                if (t && t.characters.length > 0) return t;
            }
        } catch (_) {}
        try {
            if (sel.hasOwnProperty("contents") && String(sel.contents).length > 0) return sel;
        } catch (_) {}
        alert("Die aktuelle Auswahl enthält keinen bearbeitbaren Text.", SCRIPT_NAME);
        return null;
    }

    function resetFindChange18() {
        var nothing = null;
        try { nothing = NothingEnum.NOTHING; } catch (_) {
            try { nothing = NothingEnum.nothing; } catch (_) { nothing = null; }
        }
        try { app.findGrepPreferences = nothing; } catch (_) {}
        try { app.changeGrepPreferences = nothing; } catch (_) {}
        try { app.findTextPreferences = nothing; } catch (_) {}
        try { app.changeTextPreferences = nothing; } catch (_) {}
    }

    function toolFontAvailable(name) {
        try { var f = app.fonts.itemByName(name); return f && f.isValid; } catch (_) { return false; }
    }

    function toolResolveFont(families, styles, fallback) {
        var f, st, n;
        for (f = 0; f < families.length; f++) {
            for (st = 0; st < styles.length; st++) {
                n = families[f] + "\t" + styles[st];
                if (toolFontAvailable(n)) return n;
            }
        }
        return fallback;
    }

    function toolFonts() {
        var camReg = toolResolveFont(["Cambria"], ["Regular", "Roman"], "Cambria\tRegular");
        var camBold = toolResolveFont(["Cambria"], ["Bold"], camReg);
        var camItal = toolResolveFont(["Cambria"], ["Italic", "Oblique"], camReg);
        var camBI = toolResolveFont(["Cambria"], ["Bold Italic", "BoldItalic", "Bold Oblique"], camBold);
        var kf = ["Keter YG", "KeterYG", "Keter YG Text"];
        var ketMed = toolResolveFont(kf, ["Medium", "Regular", "Book", "Normal"], "Keter YG\tMedium");
        var ketBold = toolResolveFont(kf, ["Bold", "Demi Bold", "Black"], ketMed);
        var ketItal = toolResolveFont(kf, ["Italic", "Medium Italic", "Oblique"], ketMed);
        var ketBI = toolResolveFont(kf, ["Bold Italic", "BoldItalic", "Demi Bold Italic"], ketBold);
        return {CAM_REG:camReg, CAM_BOLD:camBold, CAM_ITAL:camItal, CAM_BI:camBI,
                KET_MED:ketMed, KET_BOLD:ketBold, KET_ITAL:ketItal, KET_BI:ketBI};
    }

    var TOOL_HEB_RE = /[\u0590-\u05FF\uFB1D-\uFB4F]/;
    function toolIsHebChar(ch) { return TOOL_HEB_RE.test(ch); }

    function applyTypographyPreset(myText, opt) {
        var fonts = toolFonts();
        var cfg = {
            baseSize: opt.baseSize,
            smallSize: opt.smallSize,
            bigSize: opt.bigSize,
            alignment: opt.alignment,
            processTags: !!opt.processTags,
            twoPass: !!opt.twoPass,
            old8to10: !!opt.old8to10,
            useLegacyCharStyles: !!opt.useLegacyCharStyles,
            presetIndex: opt.presetIndex
        };

        function applyOnce() {
            if (cfg.processTags) processHtmlTags(myText, cfg, fonts);
            refreshSelectedTextReference();
            normalizeMixedFontsAndSize(myText, cfg, fonts);
        }
        function refreshSelectedTextReference() {
            if (opt.refreshFromSelection === false) return;
            try {
                var r = app.selection[0].texts[0];
                if (r && r.isValid) myText = r;
            } catch (_) {}
        }

        applyOnce();
        if (cfg.twoPass) {
            try { myText.parentStory.recompose(); } catch (_) {}
            refreshSelectedTextReference();
            applyOnce();
        }
        try { myText.parentStory.recompose(); } catch (_) {}
        setParagraphLayout(myText, cfg.alignment);
        resetFindChange18();
    }

    function processHtmlTags(myText, cfg, fonts) {
        var legacySmall = null, legacyItalic = null;
        if (cfg.useLegacyCharStyles) {
            legacySmall = getOrCreateCharacterStyle18(app.activeDocument, "Klein");
            try { legacySmall.pointSize = cfg.smallSize; } catch (_) {}
            legacyItalic = getOrCreateCharacterStyle18(app.activeDocument, "Kursiv");
            try { legacyItalic.fontStyle = "Italic"; } catch (_) {}
        }
        // <br> replacement through GREP ranges, not whole-selection assignment.
        resetFindChange18();
        app.findGrepPreferences.findWhat = "<br\\s*/?>";
        var hits = myText.findGrep(), i;
        for (i = hits.length - 1; i >= 0; i--) {
            try { hits[i].contents = "\r"; } catch (_) {}
        }
        resetFindChange18();

        // Special case first: <big><b>...</b></big>.
        processTagRange(myText, "<big>\\s*<b>([\\s\\S]+?)<\\/b>\\s*<\\/big>", /<big>\s*<b>([\s\S]+?)<\/b>\s*<\/big>/i,
            function (r) { applyFontStyleRange(r, fonts, true, false); applyRangeSize(r, cfg.bigSize); });

        processTagRange(myText, "<i>([\\s\\S]+?)<\\/i>", /<i>([\s\S]+?)<\/i>/i,
            function (r) { if (legacyItalic) try { r.appliedCharacterStyle = legacyItalic; } catch (_) {} applyFontStyleRange(r, fonts, false, true); });
        processTagRange(myText, "<b>([\\s\\S]+?)<\\/b>", /<b>([\s\S]+?)<\/b>/i,
            function (r) { applyFontStyleRange(r, fonts, true, false); });
        processTagRange(myText, "<small>([\\s\\S]+?)<\\/small>", /<small>([\s\S]+?)<\/small>/i,
            function (r) { if (legacySmall) try { r.appliedCharacterStyle = legacySmall; } catch (_) {} applyRangeSize(r, cfg.smallSize); });
        processTagRange(myText, "<big>([\\s\\S]+?)<\\/big>", /<big>([\s\S]+?)<\/big>/i,
            function (r) { applyRangeSize(r, cfg.bigSize); });
        processTagRange(myText, "<sup>([\\s\\S]+?)<\\/sup>", /<sup>([\s\S]+?)<\/sup>/i,
            function (r) {
                try { r.position = Position.SUPERSCRIPT; }
                catch (_) { try { r.characters.everyItem().position = Position.SUPERSCRIPT; } catch (__) {} }
            });
    }

    function getOrCreateCharacterStyle18(doc, name) {
        var st = null;
        try { st = doc.characterStyles.itemByName(name); if (st && st.isValid) return st; } catch (_) {}
        try { return doc.characterStyles.add({name:name}); } catch (_) { return null; }
    }

    function processTagRange(myText, grep, jsre, applyFn) {
        resetFindChange18();
        try {
            app.findGrepPreferences.findWhat = grep;
            var hits = myText.findGrep(), i, m, r;
            for (i = hits.length - 1; i >= 0; i--) {
                r = hits[i];
                m = String(r.contents).match(jsre);
                if (!m) continue;
                r.contents = m[1];
                try { applyFn(r); } catch (_) {}
            }
        } finally { resetFindChange18(); }
    }

    function applyRangeSize(rng, pt) {
        try { rng.characters.everyItem().pointSize = pt; return; } catch (_) {}
        var i;
        for (i = 0; i < rng.characters.length; i++) try { rng.characters[i].pointSize = pt; } catch (_) {}
    }

    function applyFontStyleRange(rng, fonts, wantBold, wantItalic) {
        var i, ch, t, current, isBold, isItalic, heb, target;
        for (i = 0; i < rng.characters.length; i++) {
            try {
                ch = rng.characters[i]; t = String(ch.contents); if (!t) continue;
                current = toolFontName(ch);
                isBold = wantBold || /Bold|Demi|Black/i.test(current);
                isItalic = wantItalic || /Italic|Oblique/i.test(current);
                heb = toolIsHebChar(t);
                if (heb) target = isBold && isItalic ? fonts.KET_BI : (isBold ? fonts.KET_BOLD : (isItalic ? fonts.KET_ITAL : fonts.KET_MED));
                else target = isBold && isItalic ? fonts.CAM_BI : (isBold ? fonts.CAM_BOLD : (isItalic ? fonts.CAM_ITAL : fonts.CAM_REG));
                ch.appliedFont = target;
            } catch (_) {}
        }
    }

    function normalizeMixedFontsAndSize(myText, cfg, fonts) {
        var i, ch, t, current, isBold, isItalic, heb, target, ps;
        for (i = 0; i < myText.characters.length; i++) {
            try {
                ch = myText.characters[i]; t = String(ch.contents); if (!t) continue;
                ps = Number(ch.pointSize);
                if (!cfg.processTags) {
                    ch.pointSize = cfg.baseSize;
                    ps = cfg.baseSize;
                } else {
                    if (cfg.old8to10 && ps === 8) { ch.pointSize = 10; ps = 10; }
                    if (ps !== cfg.smallSize && ps !== cfg.bigSize) ch.pointSize = cfg.baseSize;
                }

                current = toolFontName(ch);
                isBold = /Bold|Demi|Black/i.test(current);
                isItalic = /Italic|Oblique/i.test(current);
                heb = toolIsHebChar(t);
                if (heb) target = isBold && isItalic ? fonts.KET_BI : (isBold ? fonts.KET_BOLD : (isItalic ? fonts.KET_ITAL : fonts.KET_MED));
                else target = isBold && isItalic ? fonts.CAM_BI : (isBold ? fonts.CAM_BOLD : (isItalic ? fonts.CAM_ITAL : fonts.CAM_REG));
                ch.appliedFont = target;
            } catch (_) {}
        }
    }

    function toolFontName(ch) {
        try {
            var f = ch.appliedFont;
            var n = "";
            if (f && f.name) n = String(f.name); else n = String(f || "");
            try { if (ch.fontStyle) n += " " + String(ch.fontStyle); } catch (_) {}
            return n;
        } catch (_) { return ""; }
    }

    function setParagraphLayout(myText, alignment) {
        var i, p;
        for (i = 0; i < myText.paragraphs.length; i++) {
            p = myText.paragraphs[i];
            try {
                if (alignment === "center") {
                    try { p.justification = Justification.CENTER_JUSTIFIED; }
                    catch (_) { p.justification = Justification.CENTER_ALIGN; }
                } else {
                    p.justification = Justification.LEFT_JUSTIFIED;
                }
            } catch (_) {}
            setWorldReadyComposer(p);
        }
    }

    function setWorldReadyComposer(paragraph) {
        try {
            paragraph.composer = "Adobe World-Ready Paragraph Composer";
            if (String(paragraph.composer) !== "Adobe World-Ready Paragraph Composer") paragraph.composer = "$ID/HL Composer";
        } catch (_) {
            try { paragraph.composer = "$ID/HL Composer"; } catch (__) {}
        }
    }

    function removeHebrewMarks(s) {
        // String helper kept for compatibility/tests.
        return s.replace(/[\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/g, "");
    }

    function removeHebrewMarksFromText(txt) {
        // Reverse character pass preserves surrounding character/paragraph formatting.
        var i, ch, str, code;
        for (i = txt.characters.length - 1; i >= 0; i--) {
            try {
                ch = txt.characters[i]; str = String(ch.contents); if (!str) continue;
                code = str.charCodeAt(0);
                if ((code >= 0x0591 && code <= 0x05BD) || code === 0x05BF || code === 0x05C1 || code === 0x05C2 || code === 0x05C4 || code === 0x05C5 || code === 0x05C7) ch.contents = "";
            } catch (_) {}
        }
    }

    function removeDageshFromText(txt) {
        var i, ch, str;
        for (i = txt.characters.length - 1; i >= 0; i--) {
            try { ch = txt.characters[i]; str = String(ch.contents); if (str && str.charCodeAt(0) === 0x05BC) ch.contents = ""; } catch (_) {}
        }
    }

    function normalizeShinPresentationForm(txt) {
        var i, ch, str;
        for (i = txt.characters.length - 1; i >= 0; i--) {
            try { ch = txt.characters[i]; str = String(ch.contents); if (str && str.charCodeAt(0) === 0xFB2A) ch.contents = "\u05E9\u05C1"; } catch (_) {}
        }
    }

    function appendSimpleTransliteration(selObj, fontFamily, pt) {
        var hebrew = String(selObj.contents);
        if (!hebrew) throw new Error("Die Auswahl ist leer.");
        var translit = hebrewToSimpleLatin18(hebrew);
        var insertText = " [" + translit + "]";
        var ip = null, startPos = null;
        try { ip = selObj.insertionPoints.lastItem(); } catch (_) {
            try { ip = selObj.insertionPoints[selObj.insertionPoints.length - 1]; } catch (__) {}
        }
        if (!ip) throw new Error("Einfügeposition nach der Auswahl konnte nicht ermittelt werden.");
        try { startPos = ip.index; } catch (_) {}
        ip.contents = insertText;
        try {
            if (startPos !== null && selObj.parentStory) {
                var r = selObj.parentStory.characters.itemByRange(startPos, startPos + insertText.length - 1);
                var resolved = toolResolveFont([fontFamily || "Cambria"], ["Regular", "Roman"], fontFamily || "Cambria");
                try { r.appliedFont = resolved; } catch (_) { try { r.appliedFont = fontFamily || "Cambria"; } catch (__) {} }
                try { r.pointSize = pt; } catch (_) {}
            }
        } catch (_) {}
    }

    function hebrewToSimpleLatin18(hebrew) {
        // Preserves the mapping/intent of the supplied Transkription-Heb-Lat.jsx.
        var table = {
            '\u05D0':'','\u05D1':'b','\u05D2':'g','\u05D3':'d','\u05D4':'h','\u05D5':'v','\u05D6':'z','\u05D7':'ch','\u05D8':'t','\u05D9':'y',
            '\u05DB':'kh','\u05DA':'kh','\u05DC':'l','\u05DE':'m','\u05DD':'m','\u05E0':'n','\u05DF':'n','\u05E1':'s','\u05E2':'',
            '\u05E4':'p','\u05E3':'f','\u05E6':'tz','\u05E5':'tz','\u05E7':'k','\u05E8':'r','\u05E9':'sh','\u05EA':'t',
            '\u05BC':'','\u05B0':'','\u05B1':'','\u05B2':'','\u05B3':'','\u05B4':'','\u05B5':'','\u05B6':'','\u05B7':'','\u05B8':'','\u05B9':'','\u05BB':'',
            '\u05BD':'','\u05C1':'','\u05C2':'','\u05BE':'-','\u05F3':''
        };
        var result = '', i, c;
        for (i = 0; i < hebrew.length; i++) { c = hebrew.charAt(i); result += table.hasOwnProperty(c) ? table[c] : c; }
        return result;
    }

    function decodeUnicodeEscapesInText(textObj) {
        resetFindChange18();
        try {
            app.findGrepPreferences.findWhat = "\\\\u[0-9A-Fa-f]{4}";
            var hits = textObj.findGrep(), i, m;
            for (i = hits.length - 1; i >= 0; i--) {
                m = String(hits[i].contents).match(/^\\u([0-9A-Fa-f]{4})$/);
                if (m) hits[i].contents = String.fromCharCode(parseInt(m[1], 16));
            }
        } finally { resetFindChange18(); }
    }

    function decodeUnicodeEscapesInDocument(doc) {
        resetFindChange18();
        try {
            app.findGrepPreferences.findWhat = "\\\\u[0-9A-Fa-f]{4}";
            var hits = doc.findGrep(), i, m;
            for (i = hits.length - 1; i >= 0; i--) {
                m = String(hits[i].contents).match(/^\\u([0-9A-Fa-f]{4})$/);
                if (m) hits[i].contents = String.fromCharCode(parseInt(m[1], 16));
            }
        } finally { resetFindChange18(); }
    }


    // ---------------- Master/parent-page frame catalog for TXT routing ----------------

    function buildMasterCatalogFromDocument18(doc) {
        var catalog=[],i,j,ms,mp,pages,frames,descs,entry,oldUnit=null;
        if(!doc||!doc.isValid)return catalog;

        // geometricBounds / Page.bounds are "Measurement Unit" values.
        // Force POINTS so downstream labels can safely use PT_TO_MM.
        try{
            oldUnit=app.scriptPreferences.measurementUnit;
            app.scriptPreferences.measurementUnit=MeasurementUnits.POINTS;
        }catch(_){oldUnit=null;}

        try{
            for(i=0;i<safeLength(doc.masterSpreads);i++){
                try{
                    ms=doc.masterSpreads[i];
                    entry={
                        name:safeStr(getProp(ms,"name")),
                        prefix:safeStr(getProp(ms,"namePrefix")),
                        id:objId(ms),
                        pages:[],
                        slots:[],
                        slotCount:0,
                        scanWarnings:[]
                    };
                    pages=getProp(ms,"pages");
                    for(j=0;j<safeLength(pages);j++){
                        mp=pages[j];
                        descs=[];
                        frames=resolvedMasterTextFrames18(mp);
                        var k;
                        for(k=0;k<frames.length;k++){
                            try{descs.push(masterFrameDescriptorLive18(frames[k],mp));}
                            catch(eFrame){entry.scanWarnings.push("Seite "+(j+1)+", Frame "+k+": "+errText(eFrame));}
                        }
                        descs.sort(masterFrameDescriptorSort18);
                        entry.pages.push({
                            side:enumStr(getProp(mp,"side")),
                            pageIndex:j,
                            frames:descs
                        });
                    }
                    finalizeMasterCatalogEntry18(entry);
                    if(entry.slotCount>0)catalog.push(entry);
                }catch(eMaster){
                    // Do not silently hide a whole changed master spread.
                    try{
                        catalog.push({
                            name:safeStr(getProp(doc.masterSpreads[i],"name")),
                            prefix:safeStr(getProp(doc.masterSpreads[i],"namePrefix")),
                            id:objId(doc.masterSpreads[i]),
                            pages:[],slots:[],slotCount:0,
                            scanWarnings:["Musterseite konnte nicht vollständig gelesen werden: "+errText(eMaster)]
                        });
                    }catch(_){}
                }
            }
        }finally{
            if(oldUnit!==null){try{app.scriptPreferences.measurementUnit=oldUnit;}catch(_){}}
        }
        return catalog;
    }

    function resolvedMasterTextFrames18(masterPage){
        var out=[],seen={},coll=null,arr=null,i,tf,groups;

        function addFrame18(x){
            if(!x||!isValidObj(x))return;
            var id=String(objId(x));
            if(seen[id])return;
            seen[id]=true;
            out.push(x);
        }

        // Resolve the collection NOW. This avoids holding a stale collection
        // specifier after frames were added/deleted while the modeless palette
        // remained open.
        try{
            coll=getProp(masterPage,"textFrames");
            if(coll){
                try{arr=coll.everyItem().getElements();}catch(_){arr=null;}
                if(arr&&arr.length){
                    for(i=0;i<arr.length;i++)addFrame18(arr[i]);
                }else{
                    for(i=0;i<safeLength(coll);i++)addFrame18(coll[i]);
                }
            }
        }catch(_){}

        // Defensive support for text frames inside groups.
        try{
            groups=getProp(masterPage,"groups");
            collectGroupTextFrames18(groups,out,seen);
        }catch(_){}

        return out;
    }

    function collectGroupTextFrames18(groups,out,seen){
        var i,j,g,tfColl,sub;
        for(i=0;i<safeLength(groups);i++){
            try{
                g=groups[i];
                tfColl=getProp(g,"textFrames");
                for(j=0;j<safeLength(tfColl);j++){
                    var tf=tfColl[j],id=String(objId(tf));
                    if(!seen[id]){seen[id]=true;out.push(tf);}
                }
                sub=getProp(g,"groups");
                if(sub&&safeLength(sub))collectGroupTextFrames18(sub,out,seen);
            }catch(_){}
        }
    }

    function buildMasterCatalogFromReport18(report) {
        var catalog = [], parents = report && report.parentPages ? report.parentPages : [], i, j, k, pd, pg, fd, entry, descs;
        for (i = 0; i < safeLength(parents); i++) {
            pd = parents[i];
            entry = {
                name:safeStr(pd.name),
                prefix:safeStr(pd.prefix),
                id:pd.id,
                pages:[],
                slots:[],
                slotCount:0
            };
            for (j = 0; j < safeLength(pd.pages); j++) {
                pg = pd.pages[j];
                descs = [];
                for (k = 0; k < safeLength(pg.frames); k++) {
                    fd = pg.frames[k];
                    if (!fd || fd.type !== "TextFrame") continue;
                    descs.push(masterFrameDescriptorReport18(fd,pg,j));
                }
                descs.sort(masterFrameDescriptorSort18);
                entry.pages.push({
                    side:safeStr(pg.side),
                    pageIndex:j,
                    frames:descs
                });
            }
            finalizeMasterCatalogEntry18(entry);
            if (entry.slotCount > 0) catalog.push(entry);
        }
        return catalog;
    }

    function masterFrameDescriptorLive18(tf,page) {
        var gb = getProp(tf,"geometricBounds"), pb = getProp(page,"bounds"), rel = [0,0,0,0], i;
        if (gb && pb && gb.length >= 4 && pb.length >= 4) {
            rel = [Number(gb[0])-Number(pb[0]), Number(gb[1])-Number(pb[1]), Number(gb[2])-Number(pb[0]), Number(gb[3])-Number(pb[1])];
        }
        var autoNum = false, preview = "";
        try {
            var raw = tf.contents;
            preview = safeStr(raw);
            try { if (raw === SpecialCharacters.AUTO_PAGE_NUMBER) autoNum = true; } catch (_) {}
            if (containsCharCode(preview,24) || preview.indexOf("AUTO_PAGE_NUMBER") >= 0) autoNum = true;
            preview = printableControlChars(replaceCharCode(preview,24,"[AUTO_PAGE_NUMBER]"));
            if (preview.length > 40) preview = preview.substr(0,40) + "…";
        } catch (_) {}
        var d={
            id:objId(tf),
            name:safeStr(getProp(tf,"name")),
            label:safeStr(getProp(tf,"label")),
            side:enumStr(getProp(page,"side")),
            rel:rel,
            pageWidth:pb ? Number(pb[3])-Number(pb[1]) : 0,
            pageHeight:pb ? Number(pb[2])-Number(pb[0]) : 0,
            possibleAutoPageNumber:autoNum,
            preview:preview
        };
        d.role=masterFrameRole18(d);
        return d;
    }

    function masterFrameDescriptorReport18(fd,pg,pageIndex) {
        var r = fd.pageRelativeBounds || fd.bounds || {};
        var rel = [
            Number(r.topPt || 0),
            Number(r.leftPt || 0),
            Number(r.bottomPt || 0),
            Number(r.rightPt || 0)
        ];
        var pb = pg.bounds || {};
        var d={
            id:fd.id,
            name:safeStr(fd.name),
            label:safeStr(fd.label),
            side:safeStr(pg.side),
            rel:rel,
            pageWidth:Number(pb.widthPt || ((pb.rightPt||0)-(pb.leftPt||0)) || 0),
            pageHeight:Number(pb.heightPt || ((pb.bottomPt||0)-(pb.topPt||0)) || 0),
            possibleAutoPageNumber:!!(fd.textFrame && fd.textFrame.possibleAutoPageNumber),
            preview:fd.textFrame ? safeStr(fd.textFrame.masterTextPreview) : ""
        };
        d.role=masterFrameRole18(d);
        return d;
    }

    function masterFrameRole18(d){
        if(!d)return "AUX";
        if(d.possibleAutoPageNumber)return "PAGINA";
        var h=Math.max(0,Number(d.rel[2])-Number(d.rel[0]));
        var w=Math.max(0,Number(d.rel[3])-Number(d.rel[1]));
        var pw=Math.max(1,Number(d.pageWidth)||1),ph=Math.max(1,Number(d.pageHeight)||1);
        var areaRatio=(w*h)/(pw*ph),heightRatio=h/ph;
        if(heightRatio<0.075 || areaRatio<0.035)return "KOPF";
        return "TEXT";
    }

    function masterFrameRoleRank18(d){
        var r=d&&d.role?d.role:masterFrameRole18(d);
        if(r==="KOPF")return 0;
        if(r==="PAGINA")return 1;
        if(r==="TEXT")return 2;
        return 3;
    }

    function masterFrameDescriptorSort18(a,b) {
        var rr=masterFrameRoleRank18(a)-masterFrameRoleRank18(b);
        if(rr!==0)return rr;
        var dy=Number(a.rel[0])-Number(b.rel[0]);
        if(Math.abs(dy)>2)return dy;
        var aa=(Number(a.rel[2])-Number(a.rel[0]))*(Number(a.rel[3])-Number(a.rel[1]));
        var ba=(Number(b.rel[2])-Number(b.rel[0]))*(Number(b.rel[3])-Number(b.rel[1]));
        if(Math.abs(ba-aa)>2)return ba-aa;
        var dx=Number(a.rel[1])-Number(b.rel[1]);
        return dx;
    }

    function finalizeMasterCatalogEntry18(entry) {
        var max = 0, i, j, slot, d, best, bestArea = -1;
        for (i = 0; i < entry.pages.length; i++) {
            if (entry.pages[i].frames.length > max) max = entry.pages[i].frames.length;
        }
        entry.slotCount = max;
        entry.slots = [];
        for (j = 0; j < max; j++) {
            slot = {index:j+1,descriptors:[],shortLabel:"",longLabel:"",area:0,possibleAutoPageNumber:false,role:"AUX"};
            for (i = 0; i < entry.pages.length; i++) {
                d = entry.pages[i].frames[j];
                if (!d) continue;
                slot.descriptors.push(d);
                slot.possibleAutoPageNumber = slot.possibleAutoPageNumber || d.possibleAutoPageNumber;
                var ar = Math.max(0,(Number(d.rel[2])-Number(d.rel[0]))*(Number(d.rel[3])-Number(d.rel[1])));
                if (ar > bestArea) { bestArea = ar; best = d; }
                if (ar > slot.area) slot.area = ar;
            }
            var bestDesc=best || (slot.descriptors.length ? slot.descriptors[0] : null);
            slot.role=bestDesc ? (bestDesc.role||masterFrameRole18(bestDesc)) : "AUX";
            slot.shortLabel = masterFrameFriendlyLabel18(bestDesc);
            slot.longLabel = "R" + slot.index + " · [" + slot.role + "] · " + slot.shortLabel + masterSlotSides18(slot);
            if (slot.possibleAutoPageNumber) slot.longLabel += " · ⚠ PAGINA";
            entry.slots.push(slot);
            bestArea = -1; best = null;
        }
    }

    function masterSlotSides18(slot) {
        var sides = [], i, s, seen = {};
        for (i = 0; i < slot.descriptors.length; i++) {
            s = safeStr(slot.descriptors[i].side);
            if (!seen[s]) { seen[s] = true; sides.push(s.replace("_HAND","")); }
        }
        return sides.length ? " · " + sides.join("/") : "";
    }

    function masterFrameFriendlyLabel18(d) {
        if (!d) return "unbekannter Textrahmen";
        var h = Math.max(0,Number(d.rel[2])-Number(d.rel[0]));
        var w = Math.max(0,Number(d.rel[3])-Number(d.rel[1]));
        var pw = Math.max(1,Number(d.pageWidth)||Math.max(Number(d.rel[3]),1));
        var ph = Math.max(1,Number(d.pageHeight)||Math.max(Number(d.rel[2]),1));
        var cx = (Number(d.rel[1])+Number(d.rel[3]))/2/pw;
        var cy = (Number(d.rel[0])+Number(d.rel[2]))/2/ph;
        var x = cx < 0.36 ? "links" : (cx > 0.64 ? "rechts" : "mittig");
        var y = cy < 0.30 ? "oben" : (cy > 0.68 ? "unten" : "mitte");
        var areaRatio = (w*h)/(pw*ph);
        var sizeWord = areaRatio > 0.45 ? "groß" : (areaRatio > 0.18 ? "mittel" : "klein");
        var nm = trim18(d.label || d.name || "");
        var dims = round1_18(w*PT_TO_MM) + "×" + round1_18(h*PT_TO_MM) + " mm";
        var txt = nm ? nm + " · " : "";
        txt += sizeWord + " " + y + " " + x + " · " + dims;
        if(d.id!==null&&d.id!==undefined)txt += " · ID " + d.id;
        if (d.preview && d.preview !== "[AUTO_PAGE_NUMBER]") txt += " · „" + d.preview + "“";
        return txt;
    }

    function round1_18(n) { return Math.round(Number(n)*10)/10; }

    function masterSlotByIndex18(master,index) {
        var i;
        if (!master) return null;
        for (i = 0; i < master.slots.length; i++) if (master.slots[i].index === Number(index)) return master.slots[i];
        return null;
    }

    function defaultMasterSlots18(master,role) {
        var best=null,i,s,hasText=false;
        if(!master||!master.slots.length)return [];
        for(i=0;i<master.slots.length;i++)if(master.slots[i].role==="TEXT")hasText=true;
        for(i=0;i<master.slots.length;i++){
            s=master.slots[i];
            if(s.possibleAutoPageNumber)continue;
            if(hasText && s.role!=="TEXT")continue;
            if(!best||s.area>best.area)best=s;
        }
        if(!best)best=master.slots[0];
        return best?[best.index]:[];
    }

    function chooseMasterSlotOrderDialog18(master,currentSlots,title) {
        var dlg = new Window("dialog","Rahmenfolge · " + title + " · " + master.name);
        dlg.orientation = "column";
        dlg.alignChildren = "fill";
        dlg.margins = 14;
        dlg.spacing = 8;

        var intro = dlg.add("statictext",undefined,
            "Wähle die Textrahmen und ihre Fluss-Reihenfolge. Ein Slot umfasst bei Doppelseiten automatisch die entsprechende linke/rechte Rahmenposition.",
            {multiline:true});
        intro.preferredSize.width = 700;

        var cols = dlg.add("group");
        cols.orientation = "row";
        cols.alignChildren = "fill";

        var left = cols.add("panel",undefined,"Verfügbare Rahmen-Slots");
        left.orientation = "column"; left.alignChildren = "fill"; left.margins = 8;
        var avail = left.add("listbox",undefined,[],{multiselect:false});
        avail.preferredSize = [325,260];

        var mid = cols.add("group");
        mid.orientation = "column";
        mid.alignChildren = "fill";
        var addBtn = mid.add("button",undefined,">");
        var remBtn = mid.add("button",undefined,"<");
        var upBtn = mid.add("button",undefined,"↑");
        var downBtn = mid.add("button",undefined,"↓");

        var right = cols.add("panel",undefined,"Gewählte Fluss-Reihenfolge");
        right.orientation = "column"; right.alignChildren = "fill"; right.margins = 8;
        var chosen = right.add("listbox",undefined,[],{multiselect:false});
        chosen.preferredSize = [325,260];

        var chosenIdx = [], i;
        for (i = 0; i < currentSlots.length; i++) chosenIdx.push(Number(currentSlots[i]));

        function hasChosen(idx) {
            var z; for (z = 0; z < chosenIdx.length; z++) if (chosenIdx[z] === idx) return true;
            return false;
        }
        function rebuild() {
            while (avail.items.length) avail.remove(avail.items[avail.items.length-1]);
            while (chosen.items.length) chosen.remove(chosen.items[chosen.items.length-1]);
            var z, sl, item;
            for (z = 0; z < master.slots.length; z++) {
                sl = master.slots[z];
                if (!hasChosen(sl.index)) {
                    item = avail.add("item",sl.longLabel);
                    item.__slotIndex18 = sl.index;
                }
            }
            for (z = 0; z < chosenIdx.length; z++) {
                sl = masterSlotByIndex18(master,chosenIdx[z]);
                if (!sl) continue;
                item = chosen.add("item",(z+1) + ". " + sl.longLabel);
                item.__slotIndex18 = sl.index;
            }
            if (avail.items.length) avail.selection = 0;
            if (chosen.items.length) chosen.selection = Math.min(chosenIdx.length-1,chosen.items.length-1);
        }

        addBtn.onClick = function () {
            if (!avail.selection) return;
            var idx = Number(avail.selection.__slotIndex18);
            if (!hasChosen(idx)) chosenIdx.push(idx);
            rebuild();
        };
        remBtn.onClick = function () {
            if (!chosen.selection) return;
            var pos = chosen.selection.index;
            chosenIdx.splice(pos,1);
            rebuild();
            if (chosen.items.length) chosen.selection = Math.min(pos,chosen.items.length-1);
        };
        upBtn.onClick = function () {
            if (!chosen.selection) return;
            var pos = chosen.selection.index;
            if (pos <= 0) return;
            var tmp = chosenIdx[pos-1]; chosenIdx[pos-1] = chosenIdx[pos]; chosenIdx[pos] = tmp;
            rebuild(); chosen.selection = pos-1;
        };
        downBtn.onClick = function () {
            if (!chosen.selection) return;
            var pos = chosen.selection.index;
            if (pos >= chosenIdx.length-1) return;
            var tmp = chosenIdx[pos+1]; chosenIdx[pos+1] = chosenIdx[pos]; chosenIdx[pos] = tmp;
            rebuild(); chosen.selection = pos+1;
        };

        rebuild();

        var note = dlg.add("statictext",undefined,
            "⚠ PAGINA kennzeichnet automatische Seitenzahlrahmen. Diese sollten normalerweise nicht als Importziel gewählt werden.",
            {multiline:true});
        note.preferredSize.width = 700;

        var buttons = dlg.add("group"); buttons.alignment = "right";
        buttons.add("button",undefined,"Abbrechen",{name:"cancel"});
        buttons.add("button",undefined,"Übernehmen",{name:"ok"});

        if (dlg.show() !== 1) return null;
        if (!chosenIdx.length) {
            alert("Bitte mindestens einen Rahmen wählen.",SCRIPT_NAME);
            return null;
        }
        return chosenIdx;
    }

    // ---------------- TXT import / book builder ----------------

    function runTxtBookWorkflow(opt) {
        var progress=null, logFile=null, oldUnit=null, oldRedraw=null, redrawChanged=false, targetDoc=null, saveAfter=false, saveFile=null;
        try {
            var f=new File(opt.txtPath); if(!f.exists) throw new Error("TXT-Datei nicht gefunden: "+f.fsName);
            var rawTxt=readUTF8(f);
            var baseAnalysis=opt.analysis || analyzeBookTxt(rawTxt);
            var analysis=applyTxtSplitConfig18(baseAnalysis,rawTxt,opt.txtSplitConfig||{mode:"titleBody",bodyStartLine:baseAnalysis.contentStartLine||5});
            if(opt.aiPreface && opt.aiPreface.enabled && trim18(opt.aiPreface.text)){
                if(opt.aiPreface.mode==="prepend" && analysis.frontmatter && analysis.frontmatter.length){
                    analysis.frontmatter=[trim18(opt.aiPreface.text)].concat(analysis.frontmatter);
                } else {
                    analysis.frontmatter=[trim18(opt.aiPreface.text)];
                }
                analysis.frontmatterSource="openai";
                opt.frontmatter=true;
            }
            oldUnit=app.scriptPreferences.measurementUnit; app.scriptPreferences.measurementUnit=MeasurementUnits.POINTS;
            progress=createProgress(); progress.show(); setProgress(progress,3,"TXT analysieren …");

            if(opt.linkCreate){
                var copt=opt.createOptions;
                var outFolder=new Folder(copt.createOutputFolder || Folder.desktop.fsName); if(!outFolder.exists) outFolder.create();
                logFile=new File(outFolder.fsName+"/"+safeBase(copt.newDocName||"Neues_Dokument")+"_txtimport_"+stampNow()+".log"); openLog(logFile);
                var report=resolveCreateReportForImport(copt,progress,logFile);
                setProgress(progress,12,"Zieldokument aus Reiter 2 anlegen …");
                targetDoc=createDocumentFromReport(report,copt,progress,logFile);
                saveAfter=!!copt.saveCreatedDocument;
                if(saveAfter) saveFile=new File(outFolder.fsName+"/"+normalizeInddName(copt.newDocName||sanitizeFileName(analysis.title)+".indd"));
            } else {
                if(app.documents.length===0) throw new Error("Kein aktives Dokument vorhanden und Reiter 2 ist nicht gekoppelt.");
                targetDoc=app.activeDocument;
                var baseFolder=targetDoc.saved ? targetDoc.filePath : Folder.desktop;
                logFile=new File(baseFolder.fsName+"/"+safeBase(targetDoc.name)+"_txtimport_"+stampNow()+".log"); openLog(logFile);
            }

            logLine(logFile,"TXT: "+f.fsName); logLine(logFile,"Title: "+analysis.title); logLine(logFile,"TXT split mode: "+(opt.txtSplitConfig?opt.txtSplitConfig.mode:"legacy")+" bodyStartLine="+analysis.bodyStartLine+" frontmatterLines="+analysis.frontmatter.length); logLine(logFile,"Body chars: "+analysis.body.length);

            if(opt.footnotes && opt.footnotes.enabled){
                setProgress(progress,25,"Fußnoten-Markup analysieren …");
                analysis=prepareAnalysisFootnotes18(analysis,opt.footnotes,logFile);
                configureDocumentFootnotes18(targetDoc,opt.footnotes);
                logLine(logFile,"FOOTNOTE native import enabled: body="+analysis._footnotePlans.body.notes.length+
                    " frontmatter="+analysis._footnotePlans.frontmatter.notes.length+
                    " orphanMarkers="+(analysis._footnotePlans.body.orphans.length+analysis._footnotePlans.frontmatter.orphans.length));
            }

            var turboResolved=shouldUseTurboImport18(analysis.body,
                analysis._footnotePlans?analysis._footnotePlans.body:null,opt.performance);
            opt._turboBody=turboResolved;
            logLine(logFile,"IMPORT ENGINE body="+(turboResolved?"TURBO":"COMPAT v2.7")+
                " chars="+analysis.body.length+
                " footnotes="+(analysis._footnotePlans?analysis._footnotePlans.body.notes.length:0));

            if(turboResolved && opt.performance && opt.performance.disableRedraw){
                try{
                    oldRedraw=app.scriptPreferences.enableRedraw;
                    app.scriptPreferences.enableRedraw=false;
                    redrawChanged=true;
                }catch(_){}
            }

            if(opt.importTypography && opt.importTypography.enabled){
                opt._importFastOpt=makeImportFastOptions18(opt.importTypography,String(analysis.body||""));
            }else{
                opt._importFastOpt=null;
            }
            opt._importTypographyAppliedInFlow=false;

            setProgress(progress,30,"Titelseite / Vorspann …");
            var importResult=buildBookFromTxt(targetDoc,analysis,opt,progress,logFile);

            if(opt.importTypography && opt.importTypography.enabled && importResult.bodyText){
                var importFastOpt=opt._importFastOpt||makeImportFastOptions18(opt.importTypography,String(analysis.body||""));
                var importProfile=importFastOpt.importProfile;
                if(opt._importTypographyAppliedInFlow){
                    setProgress(progress,91,"Import-Typografie bereits vor Seitenaufbau angewendet · "+importTextProfileLabel18(importProfile));
                    logLine(logFile,"IMPORT TYPOGRAPHY early-calibrated; post-pagination formatting skipped");
                }else{
                    setProgress(progress,91,"Import-Typografie · "+importTextProfileLabel18(importProfile)+" …");
                    logLine(logFile,"IMPORT TYPOGRAPHY profile="+importProfile.mode+
                        " hebrewRatio="+importProfile.hebrewRatio.toFixed(4)+
                        " latinRatio="+importProfile.latinRatio.toFixed(4)+
                        " html="+importProfile.html.summary);
                    var importTypoSeconds=fastFormatProvidedText18(targetDoc,importResult.bodyText,importFastOpt);
                    logLine(logFile,"IMPORT TYPOGRAPHY completed seconds="+importTypoSeconds.toFixed(2)+
                        " size="+opt.importTypography.baseSize+" leading="+opt.importTypography.leadingMode);
                }

                if(opt.autoPages && opt.useMasterFrames && safeStoryOverflows18(importResult.bodyText,null)){
                    setProgress(progress,94,"Nach Typografie: Übersatz automatisch fortsetzen …");
                    var rrTypo=continueOversetStoryMaster18(targetDoc,
                        resolveStoryForOverflow18(importResult.bodyText,null),
                        opt.masterRoutes.body,opt,10,progress,logFile);
                    importResult.bodyPages+=rrTypo.added;
                    logLine(logFile,"IMPORT TYPOGRAPHY overflow continuation pages="+rrTypo.added);
                }
            } else if(opt.linkFast && importResult.bodyText){
                setProgress(progress,92,"FAST-Typografie anwenden …");
                var fastSeconds=fastFormatProvidedText18(targetDoc,importResult.bodyText,opt.fastOptions);
                logLine(logFile,"FAST TEXT completed seconds="+fastSeconds.toFixed(2)+" chars="+analysis.body.length);
            } else if(opt.linkTools && importResult.bodyText){
                if(analysis.body.length>500000 && !opt.allowLargeTools){
                    logLine(logFile,"TEXT TOOL skipped: body > 500000 chars");
                    alert("Der Haupttext hat mehr als 500.000 Zeichen. Die alte Reiter-3-Formatierung wurde aus Sicherheitsgründen übersprungen. Verwende für große Bücher bevorzugt die neue Schnellformatierung.",SCRIPT_NAME);
                } else {
                    setProgress(progress,92,"Reiter-3-Typografie anwenden …");
                    runUndoable("Importierten Text formatieren",function(){ applyTypographyPreset(importResult.bodyText,opt.toolOptions); });
                    // Reiter 3 normalisiert die Basis-Typografie. Semantische Überschriften
                    // werden anschließend erneut angewendet, damit Chapter/Parashah ihre
                    // eigenen Größen und Ausrichtungen behalten.
                    }
            }

            if(opt.semantic && opt.semanticStyles && importResult.bodyText){
                setProgress(progress,96,"Semantische Überschriften FAST anwenden …");
                var semCount=applySemanticStylesFast18(importResult.bodyText,analysis,targetDoc);
                logLine(logFile,"SEMANTIC FAST headings styled="+semCount);
                if(opt.autoPages && opt.useMasterFrames && safeStoryOverflows18(importResult.bodyText,null)){
                    setProgress(progress,97,"Nach Überschriften: Übersatz fortsetzen …");
                    var rrSem=continueOversetStoryMaster18(targetDoc,
                        resolveStoryForOverflow18(importResult.bodyText,null),
                        opt.masterRoutes.body,opt,10,progress,logFile);
                    importResult.bodyPages+=rrSem.added;
                    logLine(logFile,"SEMANTIC overflow continuation pages="+rrSem.added);
                }
            }

            if(saveAfter && saveFile){ targetDoc.save(saveFile); logLine(logFile,"SAVE: "+saveFile.fsName); }
            setProgress(progress,100,"Fertig");
            try{progress.close();}catch(_){} progress=null; closeLog(logFile); logFile=null;
            var importModeSummary = opt.useMasterFrames
                ? ("Musterrahmen-Modus\nHaupttext: "+routeName18(opt.masterRoutes.body))
                : ("Fallback-Raster\nRahmen pro Seite: "+opt.framesPerPage+" · Anordnung: "+frameLayoutName18(opt.frameLayout));
            importModeSummary+="\nImport-Engine: "+(opt._turboBody?"TURBO v2.14 · kalibriert":"Kompatibel v2.7");
            if(opt.importTypography&&opt.importTypography.enabled){
                importModeSummary+="\nImport-Typografie: "+opt.importTypography.baseSize+" pt · "+
                    opt.importTypography.latinFontFamily+" / "+opt.importTypography.hebrewFontFamily;
                try{
                    var fpSummary=analyzeImportTextProfile18(String(analysis.body||""),opt.importTypography.textMode||"auto");
                    importModeSummary+="\nText-Engine: "+importTextProfileLabel18(fpSummary);
                }catch(_){}
                if(opt.importTypography.footnoteRelative){
                    importModeSummary+="\nFußnoten relativ: "+opt.importTypography.footnotePercent+
                        "% = "+opt.importTypography.computedFootnoteSize+" pt";
                }
            }
            if(opt._turboBody&&analysis._footnotePlans&&analysis._footnotePlans.body.notes.length){
                importModeSummary+="\nFußnoten-Engine: "+(shouldUseBulkRtfFootnotes18(analysis._footnotePlans.body,opt.performance)?"BULK-RTF":"Native Footnotes.add()");
            }
            var fnSummary="";
            if(opt.footnotes&&opt.footnotes.enabled&&analysis._footnotePlans){
                fnSummary="\nNative Fußnoten: "+(analysis._footnotePlans.body.notes.length+analysis._footnotePlans.frontmatter.notes.length);
                var oo=analysis._footnotePlans.body.orphans.length+analysis._footnotePlans.frontmatter.orphans.length;
                if(oo)fnSummary+=" · verwaiste Quellmarker erhalten: "+oo;
            }
            var finalOverset=false;
            try{finalOverset=safeStoryOverflows18(importResult.bodyText,null);}catch(_){}
            if(finalOverset){
                throw new Error("Import wurde nicht als abgeschlossen markiert: Die Haupttext-Story enthält noch Übersatz.");
            }
            alert("TXT-Buchaufbau abgeschlossen.\n\nTitel: "+analysis.title+"\nHaupttext: "+analysis.body.length+" Zeichen\nErzeugte/benutzte Textseiten: "+importResult.bodyPages+fnSummary+
                "\nStory-Übersatz: NEIN\n"+importModeSummary+(saveFile?"\n\nGespeichert: "+saveFile.fsName:""),SCRIPT_NAME);
        } catch(e){
            try{if(logFile)logLine(logFile,"ERROR: "+errText(e));}catch(_){} try{if(logFile)closeLog(logFile);}catch(_){} try{if(progress)progress.close();}catch(_){}
            alert("TXT-Import fehlgeschlagen:\n\n"+errText(e),SCRIPT_NAME);
        } finally {
            if(redrawChanged){try{app.scriptPreferences.enableRedraw=oldRedraw;}catch(_){}}
            if(oldUnit!==null){try{app.scriptPreferences.measurementUnit=oldUnit;}catch(_){}}
        }
    }

    function resolveCreateReportForImport(copt,progress,logFile){
        if(copt.sourceMode==="file"){
            var jf=new File(copt.sourceJsonPath); if(!jf.exists) throw new Error("Layout-JSON-Datei nicht gefunden: "+jf.fsName);
            return jsonParse(readUTF8(jf));
        }
        if(!copt.snapshot) throw new Error("Keine Reiter-1-Übernahme für Reiter 2 vorhanden.");
        var d=app.documents[copt.snapshot.docIndex]; if(!d||!d.isValid) throw new Error("Quell-Dokument aus Reiter 1 ist nicht mehr verfügbar.");
        return buildReportFromDoc(d,{startIndex:Math.max(0,copt.snapshot.startPhysical-1),endIndex:Math.max(0,copt.snapshot.endPhysical-1),
            includeSections:!!copt.snapshot.includeSections,includeMasters:!!copt.snapshot.includeMasters,includeBasedOnMasters:!!copt.snapshot.includeBasedOnMasters,
            includeMasterTextContents:!!copt.snapshot.includeMasterTextContents,includeMasterTypography:!!copt.snapshot.includeMasterTypography,
            textFrames:!!copt.snapshot.textFrames,shapes:!!copt.snapshot.shapes,lines:!!copt.snapshot.lines,groups:!!copt.snapshot.groups},progress,logFile);
    }

    function analyzeBookTxt(raw){
        raw=String(raw||"").replace(/\r\n/g,"\n").replace(/\r/g,"\n");
        var lines=raw.split("\n"), non=[], i, t;
        for(i=0;i<lines.length;i++){t=trim18(lines[i]);if(t)non.push({index:i,text:t});}

        var title=non.length>0?non[0].text:"Untitled";
        var hebrewTitle=non.length>1?non[1].text:"";
        var publisher=non.length>2?non[2].text:"";
        var url=non.length>3?non[3].text:"";

        var metadataEndIndex=non.length>3?non[3].index:(non.length?non[Math.min(3,non.length-1)].index:3);
        var contentStartIndex=Math.min(lines.length,metadataEndIndex+1);
        while(contentStartIndex<lines.length && !trim18(lines[contentStartIndex])) contentStartIndex++;

        var bodyStart=-1;
        for(i=contentStartIndex;i<lines.length;i++){
            t=trim18(lines[i]);
            if(t.length>=180 || (t.length>=90 && /<(b|i|small)\b/i.test(t))){bodyStart=i;break;}
        }
        if(bodyStart<0){
            for(i=contentStartIndex;i<lines.length;i++){t=trim18(lines[i]);if(t.length>=100){bodyStart=i;break;}}
        }
        if(bodyStart<0) bodyStart=contentStartIndex;

        var pre=[], filtered=[];
        for(i=contentStartIndex;i<bodyStart;i++){t=trim18(lines[i]);if(t)pre.push(t);}
        for(i=0;i<pre.length;i++){if(pre[i]!==title && pre[i]!==hebrewTitle)filtered.push(pre[i]);}

        var semanticMap={}, counts={section:0,chapter:0,preface:0,body:0}, kind;
        for(i=contentStartIndex;i<lines.length;i++){
            t=trim18(lines[i]);
            if(!t)continue;
            if(t===title || t===hebrewTitle)continue;
            kind=classifyTxtLine18(lines,i,bodyStart);
            if(kind==="section"||kind==="chapter"||kind==="preface"){
                semanticMap[semanticKey18(t)]=kind;
                counts[kind]++;
            } else if(i>=bodyStart) counts.body++;
        }

        var body=lines.slice(bodyStart).join("\r");
        return {
            title:title,hebrewTitle:hebrewTitle,publisher:publisher,url:url,
            frontmatter:filtered,body:body,
            metadataEndLine:metadataEndIndex+1,
            contentStartLine:contentStartIndex+1,
            autoBodyStartLine:bodyStart+1,
            bodyStartLine:bodyStart+1,
            totalLines:lines.length,rawChars:raw.length,
            semanticMap:semanticMap,semanticCounts:counts
        };
    }

    function applyTxtSplitConfig18(base,raw,cfg){
        raw=String(raw||"").replace(/\r\n/g,"\n").replace(/\r/g,"\n");
        var lines=raw.split("\n"),non=[],i,t;
        for(i=0;i<lines.length;i++){t=trim18(lines[i]);if(t)non.push({index:i,text:t});}

        var metaCount=cfg&&cfg.metadataCount?Number(cfg.metadataCount):4;
        if(isNaN(metaCount)||metaCount<1)metaCount=1;
        if(metaCount>4)metaCount=4;
        if(metaCount>non.length)metaCount=non.length||1;

        var title=non.length>0?non[0].text:"Untitled";
        var hebrewTitle=metaCount>=2&&non.length>1?non[1].text:"";
        var publisher=metaCount>=3&&non.length>2?non[2].text:"";
        var url=metaCount>=4&&non.length>3?non[3].text:"";

        var metadataEndIndex=non.length?non[Math.max(0,metaCount-1)].index:0;
        var contentIndex=Math.min(lines.length,metadataEndIndex+1);
        while(contentIndex<lines.length&&!trim18(lines[contentIndex]))contentIndex++;
        var content=contentIndex+1;

        function autoBodyLine18(){
            var j,x;
            for(j=contentIndex;j<lines.length;j++){
                x=trim18(lines[j]);
                if(x.length>=180||(x.length>=90&&/<(b|i|small)\b/i.test(x)))return j+1;
            }
            for(j=contentIndex;j<lines.length;j++){x=trim18(lines[j]);if(x.length>=100)return j+1;}
            return content;
        }

        var mode=cfg&&cfg.mode?cfg.mode:"titleBody";
        var bodyLine=cfg&&cfg.bodyStartLine?Number(cfg.bodyStartLine):content;
        var frontLine=cfg&&cfg.frontStartLine?Number(cfg.frontStartLine):content;
        var autoBody=autoBodyLine18();
        if(mode==="auto")bodyLine=autoBody;
        if(isNaN(bodyLine)||bodyLine<content)bodyLine=content;
        if(bodyLine>lines.length)bodyLine=lines.length||1;
        if(isNaN(frontLine)||frontLine<content)frontLine=content;
        if(frontLine>bodyLine)frontLine=bodyLine;

        var front=[];
        if(mode!=="titleBody"){
            for(i=frontLine-1;i<bodyLine-1&&i<lines.length;i++){
                t=trim18(lines[i]);
                if(t&&t!==title&&t!==hebrewTitle)front.push(t);
            }
        }

        var body=lines.slice(Math.max(0,bodyLine-1)).join("\r");
        var semanticMap={},counts={section:0,chapter:0,preface:0,body:0},kind;
        for(i=Math.max(0,content-1);i<lines.length;i++){
            t=trim18(lines[i]);if(!t)continue;
            if(t===title||t===hebrewTitle)continue;
            kind=classifyTxtLine18(lines,i,bodyLine-1);
            if(kind==="section"||kind==="chapter"||kind==="preface"){
                semanticMap[semanticKey18(t)]=kind;counts[kind]++;
            }else if(i>=bodyLine-1)counts.body++;
        }

        return {
            title:title,hebrewTitle:hebrewTitle,publisher:publisher,url:url,
            frontmatter:front,body:body,
            metadataEndLine:metadataEndIndex+1,
            contentStartLine:content,
            autoBodyStartLine:autoBody,
            bodyStartLine:bodyLine,totalLines:lines.length,rawChars:raw.length,
            semanticMap:semanticMap,semanticCounts:counts,
            splitMode:mode,frontStartLine:frontLine,metadataCount:metaCount
        };
    }

    function classifyTxtLine18(lines,index,bodyStart){
        var t=trim18(lines[index]);
        if(!t)return "blank";
        if(/^chapter\s+[0-9ivxlcdm]+\b/i.test(t))return "chapter";
        if(/^(preface|foreword|introduction|vorwort|einleitung|הקדמה)\b/i.test(t))return "preface";
        if(isStandaloneHeading18(lines,index))return "section";
        return index>=bodyStart?"body":"frontmatter";
    }

    function isStandaloneHeading18(lines,index){
        var t=trim18(lines[index]);
        if(!t || t.length>80)return false;
        if(/^https?:\/\//i.test(t))return false;
        if(/<\/?[a-z][^>]*>/i.test(t))return false;
        if(/[.!?;:]\s*$/.test(t))return false;
        var prev=index<=0?"":trim18(lines[index-1]);
        var next=index>=lines.length-1?"":trim18(lines[index+1]);
        if(prev!=="" || next!=="")return false;
        var words=t.split(/\s+/).length;
        return words<=12;
    }

    function semanticKey18(t){return trim18(String(t||"")).replace(/\s+/g," ");}

    function bookTxtSummary(a){
        var c=a.semanticCounts||{section:0,chapter:0,preface:0};
        return "Titel: "+a.title+(a.hebrewTitle?" / "+a.hebrewTitle:"")+"\nHerausgeber/Quelle: "+a.publisher+
            "\nMetadaten bis Zeile "+(a.metadataEndLine||4)+" · Inhalt ab Zeile "+(a.contentStartLine||5)+
            "\nAuto-Vorschlag: Vorspann "+a.frontmatter.length+" Zeilen · Haupttext ab TXT-Zeile "+a.bodyStartLine+" · "+a.body.length+" Zeichen"+
            "\nSemantik: "+c.section+" Abschnitt/Parashah · "+c.chapter+" Chapter · "+c.preface+" Vorwort/Einleitung";
    }

    // ---------------- Native TXT footnotes (v2.7) ----------------

    function analyzeFootnoteMarkup18(raw,tolerant){
        var plan=parseFootnoteMarkup18(String(raw||""),{tolerant:!!tolerant,preserveOrphans:true,analysisOnly:true});
        var nonNumeric=0,i;
        for(i=0;i<plan.notes.length;i++)if(!/^\d+$/.test(plan.notes[i].sourceMarker))nonNumeric++;
        return {
            validNotes:plan.notes.length,
            orphanMarkers:plan.orphans.length,
            genericSupPairs:plan.genericSupPairs,
            classPairs:plan.classPairs,
            nonNumericMarkers:nonNumeric,
            nestedItalicNotes:plan.nestedItalicNotes,
            brNotes:plan.brNotes,
            maxNoteChars:plan.maxNoteChars
        };
    }

    function prepareAnalysisFootnotes18(a,cfg,logFile){
        if(!a)return a;
        var fm=(a.frontmatterText!==undefined&&a.frontmatterText!==null)?String(a.frontmatterText):((a.frontmatter||[]).join("\r\r"));
        var frontPlan=parseFootnoteMarkup18(fm,cfg);
        var bodyPlan=parseFootnoteMarkup18(String(a.body||""),cfg);

        a.frontmatterText=frontPlan.text;
        a.body=bodyPlan.text;
        a._footnotePlans={frontmatter:frontPlan,body:bodyPlan};

        if(logFile){
            logLine(logFile,"FOOTNOTE parse FRONT valid="+frontPlan.notes.length+" orphan="+frontPlan.orphans.length+" genericSup="+frontPlan.genericSupPairs);
            logLine(logFile,"FOOTNOTE parse BODY valid="+bodyPlan.notes.length+" orphan="+bodyPlan.orphans.length+" genericSup="+bodyPlan.genericSupPairs);
        }
        return a;
    }

    function parseFootnoteMarkup18(input,cfg){
        input=String(input||"");
        cfg=cfg||{};
        var openRe=/<i\s+class=["']footnote["']\s*>/ig;
        var m,cursor=0,out="",notes=[],orphans=[],pairNo=0,genericSupPairs=0,classPairs=0,nestedItalicNotes=0,brNotes=0,maxNoteChars=0;
        var consumedRanges=[];

        while((m=openRe.exec(input))!==null){
            var openStart=m.index,bodyStart=openRe.lastIndex;
            var sup=findFootnoteSupBefore18(input,openStart,!!cfg.tolerant);
            if(!sup){continue;}
            var end=findMatchingItalicClose18(input,bodyStart);
            if(!end){continue;}

            var rawBody=input.substring(bodyStart,end.closeStart);
            var bodyInfo=parseFootnoteBodyHtml18(rawBody);
            pairNo++;
            var token=footnoteToken18(pairNo);
            out+=input.substring(cursor,sup.start)+token;
            cursor=end.closeEnd;
            openRe.lastIndex=end.closeEnd;
            consumedRanges.push([sup.start,end.closeEnd]);

            if(sup.hasClass)classPairs++;else genericSupPairs++;
            if(bodyInfo.italicRanges.length)nestedItalicNotes++;
            if(bodyInfo.hadBr)brNotes++;
            if(bodyInfo.text.length>maxNoteChars)maxNoteChars=bodyInfo.text.length;

            notes.push({
                id:pairNo,
                token:token,
                sourceMarker:trim18(sup.marker),
                plainText:bodyInfo.text,
                italicRanges:bodyInfo.italicRanges
            });
        }
        out+=input.substring(cursor);

        // Any classed source marker that was not part of a recognized pair is
        // an orphan. Preserve it as a superscript token by default rather than
        // silently deleting source information.
        var orphanResult=replaceOrphanMarkers18(out,cfg,notes.length);
        out=orphanResult.text;
        orphans=orphanResult.orphans;

        return {
            text:out,
            notes:notes,
            orphans:orphans,
            classPairs:classPairs,
            genericSupPairs:genericSupPairs,
            nestedItalicNotes:nestedItalicNotes,
            brNotes:brNotes,
            maxNoteChars:maxNoteChars
        };
    }

    function findFootnoteSupBefore18(s,openStart,tolerant){
        var end=openStart;
        while(end>0&&/\s/.test(s.charAt(end-1)))end--;
        if(end<6)return null;
        var closeStart=s.lastIndexOf("</sup>",end);
        if(closeStart<0||closeStart+6!==end)return null;
        var start=s.lastIndexOf("<sup",closeStart);
        if(start<0)return null;
        var openEnd=s.indexOf(">",start);
        if(openEnd<0||openEnd>closeStart)return null;
        var attrs=s.substring(start,openEnd+1);
        var hasClass=/class\s*=\s*["']footnote-marker["']/i.test(attrs);
        if(!hasClass&&!tolerant)return null;
        var marker=s.substring(openEnd+1,closeStart);
        if(/[<>]/.test(marker))return null;
        return {start:start,end:end,marker:marker,hasClass:hasClass};
    }

    function findMatchingItalicClose18(s,contentStart){
        var tagRe=/<i(?:\s+[^>]*)?>|<\/i\s*>/ig;
        tagRe.lastIndex=contentStart;
        var depth=1,m;
        while((m=tagRe.exec(s))!==null){
            if(/^<\/i/i.test(m[0])){
                depth--;
                if(depth===0)return {closeStart:m.index,closeEnd:tagRe.lastIndex};
            }else depth++;
        }
        return null;
    }

    function parseFootnoteBodyHtml18(body){
        var tagRe=/<i(?:\s+[^>]*)?>|<\/i\s*>|<br\s*\/?>/ig;
        var out="",ranges=[],stack=[],m,last=0,hadBr=false;
        while((m=tagRe.exec(body))!==null){
            out+=body.substring(last,m.index);
            if(/^<br/i.test(m[0])){
                out+="\r";hadBr=true;
            }else if(/^<\/i/i.test(m[0])){
                if(stack.length){
                    var st=stack.pop();
                    if(out.length>st)ranges.push([st,out.length]);
                }
            }else{
                stack.push(out.length);
            }
            last=tagRe.lastIndex;
        }
        out+=body.substring(last);
        while(stack.length){
            var st2=stack.pop();
            if(out.length>st2)ranges.push([st2,out.length]);
        }
        return {text:out,italicRanges:ranges,hadBr:hadBr};
    }

    function footnoteToken18(id){
        var n=String(id);
        while(n.length<6)n="0"+n;
        return "@@BBFN"+n+"@@";
    }
    function orphanToken18(id){
        var n=String(id);
        while(n.length<6)n="0"+n;
        return "@@BBFM"+n+"@@";
    }

    function replaceOrphanMarkers18(text,cfg,baseId){
        var re=/<sup\s+class=["']footnote-marker["']\s*>([^<]*)<\/sup>/ig,m,last=0,out="",arr=[],id=0;
        while((m=re.exec(text))!==null){
            id++;
            out+=text.substring(last,m.index);
            if(cfg.preserveOrphans!==false){
                var token=orphanToken18(id);
                out+=token;
                arr.push({id:id,token:token,sourceMarker:trim18(m[1])});
            }else{
                out+=trim18(m[1]);
            }
            last=re.lastIndex;
        }
        out+=text.substring(last);
        return {text:out,orphans:arr};
    }

    function configureDocumentFootnotes18(doc,cfg){
        if(!doc||!cfg||!cfg.enabled)return;
        var styles=ensureFootnoteStyles18(doc,cfg),fo=getProp(doc,"footnoteOptions");
        if(!fo)return;

        try{fo.footnoteTextStyle=styles.textStyle;}catch(_){}
        try{fo.footnoteMarkerStyle=styles.markerStyle;}catch(_){}
        try{fo.markerPositioning=FootnoteMarkerPositioning.SUPERSCRIPT_MARKER;}catch(_){}
        try{fo.footnoteNumberingStyle=footnoteNumberingEnum18(cfg.numberingStyle);}catch(_){}
        try{fo.startAt=Number(cfg.startAt)||1;}catch(_){}
        try{fo.restartNumbering=footnoteRestartEnum18(cfg.restart);}catch(_){}
        try{fo.separatorText=footnoteSeparator18(cfg.separator);}catch(_){}
        try{fo.noSplitting=!cfg.allowSplit;}catch(_){}
        try{fo.enableStraddling=!!cfg.spanColumns;}catch(_){}
    }

    function footnoteNumberingEnum18(idx){
        try{
            if(idx===1)return FootnoteNumberingStyle.LOWER_ROMAN;
            if(idx===2)return FootnoteNumberingStyle.UPPER_ROMAN;
            if(idx===3)return FootnoteNumberingStyle.LOWER_LETTERS;
            if(idx===4)return FootnoteNumberingStyle.UPPER_LETTERS;
            if(idx===5)return FootnoteNumberingStyle.SYMBOLS;
            if(idx===6)return FootnoteNumberingStyle.ASTERISKS;
            return FootnoteNumberingStyle.ARABIC;
        }catch(_){return 1298231906;}
    }

    function footnoteRestartEnum18(idx){
        try{
            if(idx===1)return FootnoteRestarting.PAGE_RESTART;
            if(idx===2)return FootnoteRestarting.SPREAD_RESTART;
            if(idx===3)return FootnoteRestarting.SECTION_RESTART;
            return FootnoteRestarting.DONT_RESTART;
        }catch(_){
            if(idx===1)return 1181774451;
            if(idx===2)return 1181971059;
            if(idx===3)return 1181053555;
            return 1180988019;
        }
    }

    function footnoteSeparator18(idx){
        if(idx===1)return " ";
        if(idx===2)return "\u2003";
        return "\t";
    }

    function ensureFootnoteStyles18(doc,cfg){
        var p=ensureParaStyle18(doc,"BB · Fußnote");
        var marker=getOrCreateCharacterStyle18(doc,"BB · Fußnotenverweis");
        var italic=getOrCreateCharacterStyle18(doc,"BB · Fußnote Kursiv");
        var fonts=resolveFootnoteFonts18(cfg.fontFamily);

        try{
            p.appliedFont=fonts.regular;
            p.pointSize=cfg.pointSize;
            p.leading=cfg.leading;
            p.justification=Justification.LEFT_ALIGN;
            p.hyphenation=true;
            setWorldReadyComposer(p);
        }catch(_){}
        try{
            marker.appliedFont=fonts.regular;
            marker.pointSize=Math.max(5,Number(cfg.pointSize)*0.85);
        }catch(_){}
        try{
            italic.appliedFont=fonts.italic;
        }catch(_){}
        return {textStyle:p,markerStyle:marker,italicStyle:italic,fonts:fonts};
    }

    function resolveFootnoteFonts18(family){
        family=trim18(family)||"Cambria";
        var reg=toolResolveFont([family],["Regular","Roman","Book","Normal"],family+"\tRegular");
        var ital=toolResolveFont([family],["Italic","Oblique"],reg);
        return {regular:reg,italic:ital};
    }

    function materializeNativeFootnotes18(storyText,plan,doc,cfg,logFile,stage){
        if(!storyText||!plan||!plan.notes||!plan.notes.length)return 0;
        var styles=ensureFootnoteStyles18(doc,cfg||{}),hits=[],i,hit,id,note,fn,created=0;
        resetFindChange18();
        try{
            app.findGrepPreferences.findWhat="@@BBFN[0-9]{6}@@";
            hits=storyText.findGrep();
        }finally{resetFindChange18();}

        // Backwards: removing a token must not invalidate later text ranges.
        for(i=hits.length-1;i>=0;i--){
            hit=hits[i];
            try{
                id=parseInt(String(hit.contents).replace(/[^0-9]/g,""),10);
                if(isNaN(id)||id<1||id>plan.notes.length)continue;
                note=plan.notes[id-1];

                var ipCount=safeLength(hit.insertionPoints);
                if(ipCount<1)throw new Error("Token hat keinen Einfügepunkt.");
                fn=hit.parentStory.footnotes.add(LocationOptions.AFTER,hit.insertionPoints[ipCount-1]);
                try{fn.contents=note.plainText;}catch(_){try{fn.texts[0].contents=note.plainText;}catch(__){}}
                if(cfg&&cfg.storeSourceMarker){
                    try{fn.insertLabel("BB_SOURCE_MARKER",note.sourceMarker);}catch(_){}
                    try{fn.insertLabel("BB_IMPORT_ID",String(note.id));}catch(_){}
                }
                applyFootnoteFormatting18(fn,note,styles,cfg);
                try{hit.contents="";}catch(_){try{hit.remove();}catch(__){}}
                created++;
            }catch(e){
                if(logFile)logLine(logFile,"WARNING FOOTNOTE "+stage+" token="+safeStr(getProp(hit,"contents"))+" : "+errText(e));
            }
        }
        if(logFile)logLine(logFile,"FOOTNOTE "+stage+" created="+created+" expected="+plan.notes.length);
        return created;
    }

    function applyFootnoteFormatting18(fn,note,styles,cfg){
        var i,r,txt=null;
        try{
            if(fn.paragraphs&&fn.paragraphs.length)fn.paragraphs.everyItem().appliedParagraphStyle=styles.textStyle;
        }catch(_){}
        try{txt=fn.texts[0];}catch(_){}
        if(!txt)return;

        try{
            txt.appliedFont=styles.fonts.regular;
            txt.pointSize=cfg.pointSize;
            txt.leading=cfg.leading;
        }catch(_){}

        if(cfg&&cfg.preserveItalic&&note.italicRanges){
            for(i=0;i<note.italicRanges.length;i++){
                r=note.italicRanges[i];
                if(!r||r.length<2||r[1]<=r[0])continue;
                try{
                    txt.characters.itemByRange(r[0],r[1]-1).appliedCharacterStyle=styles.italicStyle;
                }catch(_){}
            }
        }
    }

    function materializeOrphanFootnoteMarkers18(storyText,plan,doc,cfg,logFile,stage){
        if(!storyText||!plan||!plan.orphans||!plan.orphans.length)return 0;
        var styles=ensureFootnoteStyles18(doc,cfg||{}),hits=[],i,hit,id,o,count=0;
        resetFindChange18();
        try{
            app.findGrepPreferences.findWhat="@@BBFM[0-9]{6}@@";
            hits=storyText.findGrep();
        }finally{resetFindChange18();}
        for(i=hits.length-1;i>=0;i--){
            hit=hits[i];
            try{
                id=parseInt(String(hit.contents).replace(/[^0-9]/g,""),10);
                if(isNaN(id)||id<1||id>plan.orphans.length)continue;
                o=plan.orphans[id-1];
                hit.contents=o.sourceMarker;
                try{hit.appliedCharacterStyle=styles.markerStyle;}catch(_){}
                try{hit.position=Position.SUPERSCRIPT;}catch(_){}
                count++;
            }catch(e){
                if(logFile)logLine(logFile,"WARNING ORPHAN FOOTNOTE MARKER "+stage+" : "+errText(e));
            }
        }
        if(logFile)logLine(logFile,"FOOTNOTE orphan markers "+stage+" preserved="+count);
        return count;
    }

    function buildBookFromTxt(doc,a,opt,progress,logFile){
        if (opt && opt.useMasterFrames) {
            return buildBookFromTxtMasterRouting18(doc,a,opt,progress,logFile);
        }
        var cursor=Math.max(0,(opt.importStartPhysical||1)-1), page=null, result={bodyText:null,frontmatterText:null,bodyPages:0};
        ensurePageCount(doc,Math.max(doc.pages.length,1));
        if(opt.titlePage){
            page=doc.pages[cursor]; if(opt.clearImportPages)clearPageItems(page);
            createTitlePage18(doc,page,a,opt); cursor++;
        }
        if(opt.frontmatter && a.frontmatter.length){
            if(cursor>=doc.pages.length)doc.pages.add();
            page=doc.pages[cursor]; if(opt.clearImportPages)clearPageItems(page);
            var fm=(a.frontmatterText!==undefined&&a.frontmatterText!==null)?a.frontmatterText:a.frontmatter.join("\r\r");
            var fmRes=flowTextAcrossPages18(doc,page,fm,1,0,opt.gapXmm,opt.gapYmm,true,opt.clearImportPages,progress,32,48,
                {enabled:false,hex:[],insetMm:0,strokePt:0,strokeHex:""},
                a._footnotePlans?a._footnotePlans.frontmatter:null,opt.footnotes,opt.performance);
            result.frontmatterText=fmRes.storyText;
            if(opt.semantic && opt.semanticStyles)applySemanticStyles18(fmRes.storyText,a,doc);
            cursor=fmRes.nextPageIndex;
        }
        if(opt.newBodyPage && cursor<doc.pages.length && page===doc.pages[cursor]) cursor++;
        if(cursor>=doc.pages.length)doc.pages.add();
        page=doc.pages[cursor];
        var frameStyle={enabled:!!opt.frameColors,hex:opt.frameHex||[],insetMm:opt.frameInsetMm||0,strokePt:opt.frameStrokePt||0,strokeHex:opt.frameStrokeHex||"B7C7D9"};
        var bodyRes=flowTextAcrossPages18(doc,page,a.body,opt.framesPerPage,opt.frameLayout,opt.gapXmm,opt.gapYmm,opt.autoPages,opt.clearImportPages,progress,50,88,frameStyle,
            a._footnotePlans?a._footnotePlans.body:null,opt.footnotes,opt.performance);
        result.bodyText=bodyRes.storyText; result.bodyPages=bodyRes.pagesUsed;
        logLine(logFile,"BODY pages used="+bodyRes.pagesUsed+" frames/page="+opt.framesPerPage+" layout="+opt.frameLayout);
        return result;
    }


    function buildBookFromTxtMasterRouting18(doc,a,opt,progress,logFile) {
        var result={bodyText:null,frontmatterText:null,bodyPages:0,titleText:null};
        var route,res,txt,page,tf;
        var sectionCursors={};

        function stageStartIndex18(sectionRoute){
            var key=sectionRouteRuntimeKey18(sectionRoute);
            if(sectionCursors[key]!==undefined && sectionCursors[key]!==null) return sectionCursors[key];
            var sec=resolveRuntimeSection18(doc,sectionRoute);
            if(!sec) throw new Error("Seitennummerierungsabschnitt wurde im Zieldokument nicht gefunden: "+sectionRouteLabel18(sectionRoute));
            var p=getProp(sec,"pageStart"), idx=findPageOffset(doc,p);
            if(idx===null || idx<0) throw new Error("Startseite des Abschnitts konnte nicht bestimmt werden: "+sectionRouteLabel18(sectionRoute));
            sectionCursors[key]=idx;
            return idx;
        }
        function stageFinish18(sectionRoute,nextIndex){ sectionCursors[sectionRouteRuntimeKey18(sectionRoute)]=nextIndex; }

        ensurePageCount(doc,Math.max(doc.pages.length,1));

        if(opt.titlePage){
            var titleSec=opt.sectionRoutes?opt.sectionRoutes.title:null;
            var titleStart=stageStartIndex18(titleSec);
            route=opt.masterRoutes?opt.masterRoutes.title:null;
            validateMasterRouteMasterOnly18(route,"Titelseite");
            setProgress(progress,28,"Titelseite · "+sectionRouteLabel18(titleSec)+" · "+route.masterName+" …");
            if(opt.titleLayoutMode==="masterFrames"){
                validateMasterRoute18(route,"Titelseite");
                txt=a.title+"\r"+(a.hebrewTitle||"")+"\r\r"+(a.publisher||"")+"\r"+(a.url||"");
                res=flowTextThroughMasterRoute18(doc,titleStart,txt,route,opt,false,progress,28,36,logFile,"TITLE");
                result.titleText=res.storyText; formatTitleStory18(res.storyText,a); stageFinish18(titleSec,res.nextPageIndex);
            } else {
                page=ensurePageAtOffset18(doc,titleStart); applyMasterRouteToPageOnly18(doc,page,route,opt);
                if(opt.clearImportPages) clearPageItems(page);
                tf=createTitlePage18(doc,page,a,opt);
                try{result.titleText=tf.parentStory.texts[0];}catch(_){try{result.titleText=tf.parentStory;}catch(__){}}
                stageFinish18(titleSec,titleStart+1);
                logLine(logFile,"TITLE clean page="+safeStr(getProp(page,"name"))+" section="+sectionRouteLabel18(titleSec)+" master="+route.masterName);
            }
        }

        if(opt.frontmatter && a.frontmatter.length){
            var frontSec=opt.sectionRoutes?opt.sectionRoutes.frontmatter:null;
            var frontStart=stageStartIndex18(frontSec);
            route=opt.masterRoutes?opt.masterRoutes.frontmatter:null;
            validateMasterRouteMasterOnly18(route,"Vorspann");
            txt=(a.frontmatterText!==undefined&&a.frontmatterText!==null)?a.frontmatterText:a.frontmatter.join("\r\r");
            setProgress(progress,38,"Vorspann · "+sectionRouteLabel18(frontSec)+" · "+route.masterName+" …");
            if(opt.frontLayoutMode==="masterFrames"){
                validateMasterRoute18(route,"Vorspann");
                res=flowTextThroughMasterRoute18(doc,frontStart,txt,route,opt,true,progress,38,50,logFile,"FRONT",
                    a._footnotePlans?a._footnotePlans.frontmatter:null,opt.footnotes);
            } else {
                res=flowCleanFrontmatter18(doc,frontStart,txt,route,opt,progress,38,50,logFile,
                    a._footnotePlans?a._footnotePlans.frontmatter:null,opt.footnotes);
            }
            result.frontmatterText=res.storyText;
            if(opt.semantic && opt.semanticStyles) applySemanticStyles18(res.storyText,a,doc);
            stageFinish18(frontSec,res.nextPageIndex);
        }

        var bodySec=opt.sectionRoutes?opt.sectionRoutes.body:null;
        var bodyStart=stageStartIndex18(bodySec);
        route=opt.masterRoutes?opt.masterRoutes.body:null;
        validateMasterRoute18(route,"Haupttext");
        setProgress(progress,52,"Haupttext · "+sectionRouteLabel18(bodySec)+" · "+route.masterName+" …");
        res=flowTextThroughMasterRoute18(doc,bodyStart,a.body,route,opt,!!opt.autoPages,progress,52,88,logFile,"BODY",
            a._footnotePlans?a._footnotePlans.body:null,opt.footnotes);
        result.bodyText=res.storyText; result.bodyPages=res.pagesUsed;
        stageFinish18(bodySec,res.nextPageIndex);

        logLine(logFile,"SECTION ROUTING title="+sectionRouteLabel18(opt.sectionRoutes.title)+" front="+sectionRouteLabel18(opt.sectionRoutes.frontmatter)+" body="+sectionRouteLabel18(opt.sectionRoutes.body));
        logLine(logFile,"MASTER ROUTING title="+routeName18(opt.masterRoutes.title)+" front="+routeName18(opt.masterRoutes.frontmatter)+" body="+routeName18(opt.masterRoutes.body)+" titleMode="+opt.titleLayoutMode+" frontMode="+opt.frontLayoutMode);
        return result;
    }

    function sectionRouteRuntimeKey18(route){
        if(!route) return "none";
        return safeStr(route.styleName)+"#"+safeStr(route.styleOrdinal||route.sectionIndex||0);
    }
    function sectionRouteLabel18(route){
        if(!route) return "—";
        return (route.styleName||"UNBEKANNT")+" · "+(route.startPageName||("§"+route.sectionIndex));
    }
    function runtimeSectionStyleName18(sec){
        var inf=pageNumberStyleInfo(getProp(sec,"pageNumberStyle"));
        return inf&&inf.name?inf.name:enumStr(getProp(sec,"pageNumberStyle"));
    }
    function resolveRuntimeSection18(doc,route){
        if(!doc||!route) return null;
        var sections=getProp(doc,"sections"),i,sec,style,matchOrdinal=0;
        if(route.sectionIndex!==null&&route.sectionIndex!==undefined){
            i=Number(route.sectionIndex)-1;
            if(i>=0&&i<safeLength(sections)){try{sec=sections[i];style=runtimeSectionStyleName18(sec);if(!route.styleName||style===route.styleName)return sec;}catch(_){}}
        }
        for(i=0;i<safeLength(sections);i++){
            try{sec=sections[i];style=runtimeSectionStyleName18(sec);if(route.styleName&&style!==route.styleName)continue;var ps=getProp(sec,"pageStart");if(route.startPageName&&safeStr(getProp(ps,"name"))===safeStr(route.startPageName))return sec;}catch(_){}
        }
        for(i=0;i<safeLength(sections);i++){
            try{sec=sections[i];style=runtimeSectionStyleName18(sec);if(route.styleName&&style!==route.styleName)continue;matchOrdinal++;if(matchOrdinal===Number(route.styleOrdinal||1))return sec;}catch(_){}
        }
        return null;
    }
    function validateMasterRouteMasterOnly18(route,label){ if(!route||!route.masterName)throw new Error(label+": keine Musterseite gewählt."); }
    function applyMasterRouteToPageOnly18(doc,page,route,opt){
        var master=findMasterSpreadForRoute18(doc,route); if(!master||!master.isValid)throw new Error("Musterseite „"+route.masterName+"“ wurde im Zieldokument nicht gefunden.");
        if(opt.masterAutoApply){try{page.appliedMaster=master;}catch(e){throw new Error("Musterseite „"+route.masterName+"“ konnte nicht angewendet werden: "+errText(e));}}
        return master;
    }
    function formatTitleStory18(storyText,a){
        if(!storyText)return; var pars=getProp(storyText,"paragraphs"),fonts=toolFonts(),i;
        try{if(safeLength(pars)>0){pars[0].justification=Justification.CENTER_ALIGN;pars[0].pointSize=26;pars[0].appliedFont=fonts.CAM_REG;}}catch(_){}
        try{if(a.hebrewTitle&&safeLength(pars)>1){pars[1].justification=Justification.CENTER_ALIGN;pars[1].pointSize=30;pars[1].appliedFont=fonts.KET_MED;setWorldReadyComposer(pars[1]);}}catch(_){}
        for(i=2;i<safeLength(pars);i++){try{pars[i].justification=Justification.CENTER_ALIGN;pars[i].pointSize=11;pars[i].appliedFont=fonts.CAM_REG;}catch(_){}}
    }
    function flowCleanFrontmatter18(doc,startPageIndex,text,route,opt,progress,pStart,pEnd,logFile,footPlan,footCfg){
        var master=findMasterSpreadForRoute18(doc,route);if(!master||!master.isValid)throw new Error("Vorspann: Musterseite „"+route.masterName+"“ wurde nicht gefunden.");
        var page=ensurePageAtOffset18(doc,startPageIndex),firstFrame=null,lastFrame=null,storyText=null,pagesUsed=0,guard=0;
        function addPage18(p){
            if(opt.masterAutoApply){try{p.appliedMaster=master;}catch(_){}}
            if(opt.clearImportPages)clearPageItems(p);
            var frames=createFrameGrid18(p,1,0,opt.gapXmm,opt.gapYmm,doc,{enabled:false,hex:[],insetMm:0,strokePt:0,strokeHex:""}),tf=frames[0];
            if(lastFrame){try{lastFrame.nextTextFrame=tf;}catch(e){throw new Error("Vorspann: Textrahmen konnten nicht verkettet werden: "+errText(e));}}
            if(!firstFrame)firstFrame=tf;lastFrame=tf;pagesUsed++;logLine(logFile,"FRONT clean page="+safeStr(getProp(p,"name"))+" master="+route.masterName);
        }
        addPage18(page);firstFrame.contents=text;try{storyText=firstFrame.parentStory.texts[0];}catch(_){try{storyText=firstFrame.parentStory;}catch(__){}}
        if(footPlan&&footPlan.notes&&footPlan.notes.length) materializeNativeFootnotes18(storyText,footPlan,doc,footCfg,logFile,"FRONT");
        if(footPlan&&footPlan.orphans&&footPlan.orphans.length) materializeOrphanFootnoteMarkers18(storyText,footPlan,doc,footCfg,logFile,"FRONT");
        try{firstFrame.parentStory.recompose();}catch(_){}
        while(safeStoryOverflows18(storyText,lastFrame)&&guard<5000){page=doc.pages.add(LocationOptions.AFTER,page);addPage18(page);guard++;try{firstFrame.parentStory.recompose();}catch(_){}if(progress){var ratio=Math.min(0.97,pagesUsed/Math.max(12,pagesUsed+8));setProgress(progress,pStart+Math.round(ratio*(pEnd-pStart)),"Vorspann · "+pagesUsed+" Seiten");}}
        if(guard>=5000&&safeStoryOverflows18(storyText,lastFrame))throw new Error("Vorspann: Sicherheitsabbruch nach 5000 zusätzlichen Seiten.");
        return {storyText:storyText,pagesUsed:pagesUsed,nextPageIndex:findPageOffset(doc,page)+1,lastFrame:lastFrame};
    }

    function routeName18(r) {
        return r ? r.masterName+" ["+(r.slotIndices?r.slotIndices.join(","):"")+"]" : "—";
    }

    function validateMasterRoute18(route,label) {
        if (!route || !route.masterName) throw new Error(label+": keine Musterseite gewählt.");
        if (!route.slotIndices || !route.slotIndices.length) throw new Error(label+": keine Zielrahmen gewählt.");
    }


    // ---------------- TURBO large-file flow (v2.8) ----------------

    function shouldUseTurboImport18(text,footPlan,perf){
        if(!perf)return false;
        if(perf.mode===2)return false; // compatibility v2.7
        if(perf.mode===1)return true;  // forced turbo
        var chars=String(text||"").length;
        var notes=(footPlan&&footPlan.notes)?footPlan.notes.length:0;
        return chars>=Number(perf.thresholdChars||250000) || notes>=Number(perf.thresholdNotes||100);
    }

    function turboFootnoteChars18(plan){
        if(!plan||!plan.notes)return 0;
        var n=0,i;
        for(i=0;i<plan.notes.length;i++)n+=String(plan.notes[i].plainText||"").length+12;
        return n;
    }

    function turboEstimatedPages18(text,footPlan,perf){
        perf=perf||{};
        var effective=String(text||"").length + turboFootnoteChars18(footPlan);
        var cpp=Math.max(500,Number(perf.charsPerPage)||2200);
        var reserve=Math.max(0,Number(perf.reservePercent)||25);
        var pages=Math.ceil((effective/cpp)*(1+reserve/100));
        if(pages<2)pages=2;
        if(pages>5000)pages=5000;
        return pages;
    }

    function sameSection18(a,b){
        if(!a||!b)return false;
        try{
            var sa=getProp(a,"appliedSection"),sb=getProp(b,"appliedSection");
            if(sa&&sb&&isValidObj(sa)&&isValidObj(sb)){
                var ia=getProp(sa,"id"),ib=getProp(sb,"id");
                if(ia!==null&&ib!==null)return ia===ib;
                return sa===sb;
            }
        }catch(_){}
        return false;
    }

    function insertLargeTextChunks18(firstFrame,text,chunkSize,progress,pStart,pEnd,label){
        text=String(text||"");
        chunkSize=Math.max(20000,Number(chunkSize)||120000);
        try{firstFrame.contents="";}catch(_){}
        var story=firstFrame.parentStory,pos=0,total=text.length,part=0,end,ipCount;
        while(pos<total){
            end=Math.min(total,pos+chunkSize);
            ipCount=safeLength(story.insertionPoints);
            if(ipCount<1)throw new Error(label+": Story hat keinen Einfügepunkt.");
            story.insertionPoints[ipCount-1].contents=text.substring(pos,end);
            pos=end;part++;
            if(progress){
                setProgress(progress,pStart+Math.round((pos/Math.max(1,total))*(pEnd-pStart)),
                    label+" · Textblock "+part+" · "+Math.round(pos/1000)+"k / "+Math.round(total/1000)+"k Zeichen");
            }
        }
        var storyText=null;
        try{storyText=story.texts[0];}catch(_){storyText=story;}
        return storyText;
    }

    function storyEndPageOffset18(doc,storyText){
        try{
            var ips=storyText.insertionPoints,n=safeLength(ips);
            if(!n)return null;
            var ip=ips[n-1],pfs=getProp(ip,"parentTextFrames");
            if(pfs&&safeLength(pfs)){
                var pg=getProp(pfs[0],"parentPage");
                if(pg&&isValidObj(pg))return findPageOffset(doc,pg);
            }
        }catch(_){}
        return null;
    }

    function trimTurboCreatedPages18(doc,createdPages,endPageOffset,logFile){
        if(endPageOffset===null||endPageOffset===undefined)return 0;
        var removed=0,i,p,idx;
        for(i=createdPages.length-1;i>=0;i--){
            p=createdPages[i];
            try{
                if(!p||!p.isValid)continue;
                idx=findPageOffset(doc,p);
                if(idx!==null&&idx>endPageOffset){
                    p.remove();
                    removed++;
                }
            }catch(_){}
        }
        if(logFile&&removed)logLine(logFile,"TURBO reserve pages trimmed="+removed);
        return removed;
    }

    // ---------------- BULK RTF footnote bridge (v2.9) ----------------

    function shouldUseBulkRtfFootnotes18(plan,perf){
        if(!plan||!plan.notes||!plan.notes.length||!perf)return false;
        var mode=Number(perf.bulkFootnoteEngine||0);
        if(mode===2)return false; // native Footnotes.add() v2.8
        if(mode===1)return true;  // always BULK
        return plan.notes.length>=Math.max(1,Number(perf.bulkFootnoteThreshold)||50);
    }

    function rtfSignedUnit18(code){
        return code>32767 ? code-65536 : code;
    }

    function rtfEscapeText18(text){
        text=String(text||"");
        var out=[],i=0,c,code,next;
        while(i<text.length){
            c=text.charAt(i);
            code=text.charCodeAt(i);
            if(c==="\\"){out.push("\\\\");}
            else if(c==="{"){out.push("\\{");}
            else if(c==="}"){out.push("\\}");}
            else if(c==="\r"){
                if(i+1<text.length&&text.charAt(i+1)==="\n")i++;
                out.push("\\par ");
            }else if(c==="\n"){out.push("\\par ");}
            else if(c==="\t"){out.push("\\tab ");}
            else if(code>=32&&code<=126){out.push(c);}
            else{out.push("\\u"+rtfSignedUnit18(code)+"?");}
            i++;
        }
        return out.join("");
    }

    function rtfFootnoteBody18(note,cfg){
        var text=String(note&&note.plainText||""),ranges=(note&&note.italicRanges)||[];
        if(!cfg||!cfg.preserveItalic||!ranges.length)return rtfEscapeText18(text);
        // Ranges are offsets in plainText. Normalize/sort and emit \i toggles.
        var arr=[],i,r;
        for(i=0;i<ranges.length;i++){
            r=ranges[i];
            if(r&&r.length>=2&&r[1]>r[0])arr.push([Math.max(0,r[0]),Math.min(text.length,r[1])]);
        }
        arr.sort(function(a,b){return a[0]-b[0];});
        var out=[],pos=0;
        for(i=0;i<arr.length;i++){
            r=arr[i];
            if(r[0]<pos)r[0]=pos;
            if(r[0]>pos)out.push(rtfEscapeText18(text.substring(pos,r[0])));
            if(r[1]>r[0]){
                out.push("{\\i ");
                out.push(rtfEscapeText18(text.substring(r[0],r[1])));
                out.push("\\i0}");
                pos=r[1];
            }
        }
        if(pos<text.length)out.push(rtfEscapeText18(text.substring(pos)));
        return out.join("");
    }

    function writeBulkRtfFootnoteFile18(tokenText,plan,cfg,logFile,stage){
        var stamp=String(new Date().getTime())+"_"+Math.floor(Math.random()*100000);
        var f=new File(Folder.temp.fsName+"/bb_bulk_footnotes_"+stamp+".rtf");
        f.encoding="BINARY";
        if(!f.open("w"))throw new Error("Temporäre RTF-Datei kann nicht erzeugt werden: "+f.fsName);

        var bodyFs=Math.max(12,Math.round(9*2));
        var noteFs=Math.max(10,Math.round((cfg&&cfg.pointSize?cfg.pointSize:8)*2));
        var header="{\\rtf1\\ansi\\ansicpg1252\\uc1\\deff0"+
            "{\\fonttbl{\\f0\\fnil\\fcharset0 Cambria;}}"+
            "\\fet0\\ftnbj\\pard\\plain\\f0\\fs"+bodyFs+" ";
        f.write(header);

        var re=/@@BB(FN|FM)([0-9]{6})@@/g,m,last=0,kind,id,note,orphan;
        while((m=re.exec(tokenText))!==null){
            if(m.index>last)f.write(rtfEscapeText18(tokenText.substring(last,m.index)));
            kind=m[1];id=parseInt(m[2],10);
            if(kind==="FN"&&id>=1&&id<=plan.notes.length){
                note=plan.notes[id-1];
                // Standard RTF automatic footnote reference + footnote destination.
                f.write("{\\super\\chftn");
                f.write("{\\footnote\\pard\\plain\\f0\\fs"+noteFs+"{\\super\\chftn}\\tab ");
                f.write(rtfFootnoteBody18(note,cfg));
                f.write("}}");
            }else if(kind==="FM"&&plan.orphans&&id>=1&&id<=plan.orphans.length){
                orphan=plan.orphans[id-1];
                f.write("{\\super "+rtfEscapeText18(orphan.sourceMarker)+"}");
            }
            last=re.lastIndex;
        }
        if(last<tokenText.length)f.write(rtfEscapeText18(tokenText.substring(last)));
        f.write("}");
        f.close();

        if(logFile)logLine(logFile,"BULK RTF "+stage+" file="+f.fsName+" notes="+plan.notes.length+" bytes="+f.length);
        return f;
    }

    function placeBulkRtfFootnotes18(firstFrame,tokenText,plan,doc,cfg,perf,logFile,stage,progress,pStart,pEnd){
        if(!firstFrame||!plan||!plan.notes||!plan.notes.length)throw new Error(stage+": BULK-RTF benötigt Zielrahmen und Fußnotenplan.");
        var rtfFile=null,oldPrefs=null,storyText=null;
        try{
            setProgress(progress,pStart,stage+" · BULK-RTF erzeugen · "+plan.notes.length+" Fußnoten …");
            rtfFile=writeBulkRtfFootnoteFile18(tokenText,plan,cfg,logFile,stage);

            // Preserve the application-level Word/RTF import preferences.
            try{oldPrefs=app.wordRTFImportPreferences.properties;}catch(_){oldPrefs=null;}
            try{
                app.wordRTFImportPreferences.importFootnotes=true;
                app.wordRTFImportPreferences.importEndnotes=false;
                app.wordRTFImportPreferences.importUnusedStyles=false;
                app.wordRTFImportPreferences.preserveGraphics=false;
                app.wordRTFImportPreferences.removeFormatting=false;
                app.wordRTFImportPreferences.preserveLocalOverrides=true;
                app.wordRTFImportPreferences.useTypographersQuotes=false;
            }catch(_){}

            try{firstFrame.contents="";}catch(_){}
            setProgress(progress,pStart+Math.round((pEnd-pStart)*0.35),
                stage+" · BULK-RTF einmalig in InDesign platzieren …");

            var ips=firstFrame.insertionPoints;
            if(!ips||!safeLength(ips))throw new Error(stage+": Zielrahmen hat keinen Einfügepunkt.");
            ips[0].place(rtfFile,false);

            try{storyText=firstFrame.parentStory.texts[0];}catch(_){try{storyText=firstFrame.parentStory;}catch(__){}}
            if(!storyText)throw new Error(stage+": Nach RTF-Import konnte die Story nicht ermittelt werden.");

            setProgress(progress,pEnd,stage+" · BULK-RTF importiert · InDesign verwaltet die Fußnoten");
            if(logFile){
                var importedCount=0;
                try{importedCount=safeLength(firstFrame.parentStory.footnotes);}catch(_){}
                logLine(logFile,"BULK RTF "+stage+" imported footnotes="+importedCount+" expected="+plan.notes.length);
            }
            return storyText;
        }finally{
            try{if(oldPrefs)app.wordRTFImportPreferences.properties=oldPrefs;}catch(_){}
            try{if(rtfFile&&rtfFile.exists)rtfFile.remove();}catch(_){}
        }
    }

    function materializeNativeFootnotesTurbo18(storyText,plan,doc,cfg,logFile,stage,progress,pStart,pEnd){
        if(!storyText||!plan||!plan.notes||!plan.notes.length)return 0;
        var styles=ensureFootnoteStyles18(doc,cfg||{}),hits=[],made=[],i,hit,id,note,fn,created=0,total=plan.notes.length;
        resetFindChange18();
        try{
            app.findGrepPreferences.findWhat="@@BBFN[0-9]{6}@@";
            hits=storyText.findGrep();
        }finally{resetFindChange18();}

        for(i=hits.length-1;i>=0;i--){
            hit=hits[i];
            try{
                id=parseInt(String(hit.contents).replace(/[^0-9]/g,""),10);
                if(isNaN(id)||id<1||id>plan.notes.length)continue;
                note=plan.notes[id-1];
                var ipCount=safeLength(hit.insertionPoints);
                if(ipCount<1)continue;
                fn=hit.parentStory.footnotes.add(LocationOptions.AFTER,hit.insertionPoints[ipCount-1]);
                try{fn.contents=note.plainText;}catch(_){try{fn.texts[0].contents=note.plainText;}catch(__){}}
                if(cfg&&cfg.storeSourceMarker){
                    try{fn.insertLabel("BB_SOURCE_MARKER",note.sourceMarker);}catch(_){}
                    try{fn.insertLabel("BB_IMPORT_ID",String(note.id));}catch(_){}
                }
                try{hit.contents="";}catch(_){try{hit.remove();}catch(__){}}
                made.push({fn:fn,note:note});
                created++;
            }catch(e){
                if(logFile)logLine(logFile,"WARNING TURBO FOOTNOTE "+stage+" : "+errText(e));
            }
            if(progress && (created%50===0 || i===0)){
                setProgress(progress,pStart+Math.round((created/Math.max(1,total))*(pEnd-pStart)),
                    stage+" · Fußnoten "+created+" / "+total);
            }
        }

        // Base paragraph/marker styles are already configured document-wide.
        // Only local italic spans need per-note work.
        if(cfg&&cfg.preserveItalic){
            for(i=0;i<made.length;i++){
                note=made[i].note;fn=made[i].fn;
                if(!note||!note.italicRanges||!note.italicRanges.length)continue;
                try{
                    var txt=fn.texts[0],j,r;
                    for(j=0;j<note.italicRanges.length;j++){
                        r=note.italicRanges[j];
                        if(r&&r.length>=2&&r[1]>r[0]){
                            try{txt.characters.itemByRange(r[0],r[1]-1).appliedCharacterStyle=styles.italicStyle;}catch(_){}
                        }
                    }
                }catch(_){}
            }
        }

        if(logFile)logLine(logFile,"TURBO FOOTNOTE "+stage+" created="+created+" expected="+total);
        return created;
    }

    function insertionIndex18(ip){
        try{return Number(ip.index);}catch(_){return -1;}
    }

    function frameFirstInsertionIndex18(tf){
        try{
            var ips=tf.insertionPoints,n=safeLength(ips);
            if(!n)return -1;
            try{return insertionIndex18(ips.firstItem());}catch(_){return insertionIndex18(ips[0]);}
        }catch(_){return -1;}
    }

    function frameLastInsertionIndex18(tf){
        try{
            var ips=tf.insertionPoints,n=safeLength(ips);
            if(!n)return -1;
            try{return insertionIndex18(ips.lastItem());}catch(_){return insertionIndex18(ips[n-1]);}
        }catch(_){return -1;}
    }

    function storyLastInsertionIndex18(storyText,lastFrame){
        var st=resolveStoryForOverflow18(storyText,lastFrame),ips,n;
        if(!st)return -1;
        try{
            ips=st.insertionPoints;n=safeLength(ips);
            if(!n)return -1;
            try{return insertionIndex18(ips.lastItem());}catch(_){return insertionIndex18(ips[n-1]);}
        }catch(_){return -1;}
    }

    function turboCalibration18(firstFrame,lastFrame,storyText,pagesPrepared,perf){
        var first=frameFirstInsertionIndex18(firstFrame);
        var visibleEnd=frameLastInsertionIndex18(lastFrame);
        var totalEnd=storyLastInsertionIndex18(storyText,lastFrame);
        var visible=(first>=0&&visibleEnd>=first)?(visibleEnd-first):0;
        var total=(first>=0&&totalEnd>=first)?(totalEnd-first):0;
        var cpp=pagesPrepared>0?visible/pagesPrepared:0;
        var reserve=Math.max(0,Number(perf.calibrationReservePercent)||8);
        var target=(cpp>10&&total>0)?Math.ceil((total/cpp)*(1+reserve/100)):0;
        if(target<pagesPrepared)target=pagesPrepared;
        if(target>5000)target=5000;
        return {first:first,visibleEnd:visibleEnd,totalEnd:totalEnd,visibleChars:visible,totalChars:total,charsPerPage:cpp,targetPages:target};
    }

    function turboRemainingPages18(lastFrame,storyText,charsPerPage,perf){
        var end=frameLastInsertionIndex18(lastFrame),total=storyLastInsertionIndex18(storyText,lastFrame);
        if(end<0||total<0||total<=end||charsPerPage<=10)return 0;
        var rem=total-end,res=Math.max(3,Number(perf.calibrationReservePercent)||8);
        return Math.max(1,Math.ceil((rem/charsPerPage)*(1+res/100)));
    }

    function turboPulsePagePanel18(perf){
        if(!perf||!perf.pulsePagePanel)return;
        var old=null;
        try{
            old=app.scriptPreferences.enableRedraw;
            app.scriptPreferences.enableRedraw=true;
            try{app.redraw();}catch(_){}
        }catch(_){}
        finally{
            if(old!==null){try{app.scriptPreferences.enableRedraw=old;}catch(_){}}
        }
    }

    function flowTextThroughMasterRouteTurbo18(doc,startPageIndex,text,route,opt,autoPages,progress,pStart,pEnd,logFile,stageName,footPlan,footCfg){
        var perf=opt.performance||{},master=findMasterSpreadForRoute18(doc,route);
        if(!master||!master.isValid)throw new Error(stageName+": Musterseite „"+route.masterName+"“ wurde nicht gefunden.");

        var startPage=ensurePageAtOffset18(doc,startPageIndex);
        var page=startPage,firstFrame=null,lastFrame=null,storyText=null,pagesPrepared=0;
        var createdPages=[],preparedPages=[],startSectionPage=startPage;
        var fullEstimate=perf.preallocate?turboEstimatedPages18(text,footPlan,perf):1;
        var hasFootnotes=!!(footPlan&&footPlan.notes&&footPlan.notes.length);
        var earlyTypography=stageName==="BODY" && !!opt._importFastOpt &&
            !!perf.calibrateTypographyFirst && !hasFootnotes;
        var seedPages=Math.max(4,Math.min(50,Number(perf.calibrationPages)||12));
        var estimate=earlyTypography?Math.min(fullEstimate,seedPages):fullEstimate;
        var batch=Math.max(5,Number(perf.pageBatch)||20);
        var pulseEvery=Math.max(50,Number(perf.pulseEveryPages)||200);
        var lastPulse=0;

        function addRoutePageTurbo18(p,created){
            var frames=overrideRouteFramesOnPage18(doc,p,master,route,opt),i;
            if(!frames.length)throw new Error(stageName+": keine gewählten Rahmen auf Seite "+safeStr(getProp(p,"name")));
            for(i=0;i<frames.length;i++){
                unlinkTextFrame18(frames[i]);
                if(lastFrame){
                    try{lastFrame.nextTextFrame=frames[i];}
                    catch(e){throw new Error(stageName+": Rahmenverkettung fehlgeschlagen: "+errText(e));}
                }
                if(!firstFrame)firstFrame=frames[i];
                lastFrame=frames[i];
            }
            preparedPages.push(p);
            if(created)createdPages.push(p);
            pagesPrepared++;
            if(perf.pulsePagePanel && pagesPrepared-lastPulse>=pulseEvery){
                lastPulse=pagesPrepared;
                turboPulsePagePanel18(perf);
            }
        }

        function appendPagesNoRecompose18(count,labelText,progressValue){
            count=Math.max(0,Math.floor(Number(count)||0));
            var n;
            for(n=0;n<count;n++){
                page=doc.pages.add(LocationOptions.AFTER,page);
                addRoutePageTurbo18(page,true);
                if(progress && (n%50===0 || n===count-1)){
                    setProgress(progress,progressValue,
                        labelText+" · Rahmen-Seiten "+pagesPrepared+" · echte Dokumentseiten "+doc.pages.length);
                }
            }
        }

        setProgress(progress,pStart,stageName+" · TURBO · "+(earlyTypography?"Kalibrierseiten":"Seitenrahmen")+" vorbereiten …");
        addRoutePageTurbo18(page,false);

        var existingIndex=startPageIndex+1,created=false;
        while(pagesPrepared<estimate){
            created=false;
            if(existingIndex<doc.pages.length && sameSection18(startSectionPage,doc.pages[existingIndex])){
                page=doc.pages[existingIndex];
                existingIndex++;
            }else{
                page=doc.pages.add(LocationOptions.AFTER,page);
                created=true;
                existingIndex=findPageOffset(doc,page)+1;
            }
            addRoutePageTurbo18(page,created);
            if(progress && (pagesPrepared%Math.max(5,Math.min(50,batch))===0 || pagesPrepared===estimate)){
                setProgress(progress,pStart+Math.round((pagesPrepared/Math.max(1,estimate))*Math.max(1,(pEnd-pStart)*0.15)),
                    stageName+" · TURBO · Rahmen "+pagesPrepared+" / "+estimate+" · Dokumentseiten "+doc.pages.length);
            }
        }

        var textStart=pStart+Math.round((pEnd-pStart)*0.16);
        var textEnd=pStart+Math.round((pEnd-pStart)*0.34);
        var bulkRtfUsed=false,bulkError=null;

        if(shouldUseBulkRtfFootnotes18(footPlan,perf)){
            try{
                storyText=placeBulkRtfFootnotes18(firstFrame,text,footPlan,doc,footCfg,perf,logFile,stageName,progress,textStart,textEnd);
                bulkRtfUsed=true;
            }catch(eBulk){
                bulkError=eBulk;
                if(logFile)logLine(logFile,"WARNING BULK RTF failed; "+errText(eBulk));
                if(!perf.bulkFootnoteFallback)throw eBulk;
            }
        }

        if(!bulkRtfUsed){
            storyText=insertLargeTextChunks18(firstFrame,text,perf.chunkChars,progress,textStart,textEnd,stageName+" · TURBO");
        }

        var calibration=null;

        if(earlyTypography){
            setProgress(progress,pStart+Math.round((pEnd-pStart)*0.37),
                stageName+" · Import-Typografie VOR Seitenaufbau · "+importTextProfileLabel18(opt._importFastOpt.importProfile)+" …");
            fastFormatImportOptimized18(doc,storyText,opt._importFastOpt);
            opt._importTypographyAppliedInFlow=true;
            try{firstFrame.parentStory.recompose();}catch(_){}

            calibration=turboCalibration18(firstFrame,lastFrame,storyText,pagesPrepared,perf);
            if(logFile)logLine(logFile,"CALIBRATION seedPages="+pagesPrepared+
                " visibleChars="+calibration.visibleChars+
                " totalChars="+calibration.totalChars+
                " cpp="+calibration.charsPerPage.toFixed(2)+
                " target="+calibration.targetPages);

            if(calibration.targetPages<=pagesPrepared || calibration.charsPerPage<=10){
                // Defensive fallback if frame insertion indices cannot be measured.
                calibration.targetPages=Math.max(pagesPrepared,Math.min(5000,fullEstimate));
            }

            if(calibration.targetPages>pagesPrepared){
                setProgress(progress,pStart+Math.round((pEnd-pStart)*0.42),
                    stageName+" · gemessen "+Math.round(calibration.charsPerPage)+" Zeichen/Seite · Ziel ca. "+calibration.targetPages+" …");
                appendPagesNoRecompose18(calibration.targetPages-pagesPrepared,
                    stageName+" · kalibriert Seiten anlegen",
                    pStart+Math.round((pEnd-pStart)*0.50));
                try{firstFrame.parentStory.recompose();}catch(_){}
                turboPulsePagePanel18(perf);
            }

            var calGuard=0,needed;
            while(autoPages&&safeStoryOverflows18(storyText,lastFrame)&&calGuard<10){
                needed=turboRemainingPages18(lastFrame,storyText,calibration.charsPerPage,perf);
                if(needed<1)needed=Math.max(batch,50);
                if(needed>1000)needed=1000;
                appendPagesNoRecompose18(needed,
                    stageName+" · Resttext berechnet weiterführen",
                    pStart+Math.round((pEnd-pStart)*0.56));
                try{firstFrame.parentStory.recompose();}catch(_){}
                calGuard++;
            }
            if(autoPages&&safeStoryOverflows18(storyText,lastFrame)){
                throw new Error(stageName+": Kalibrierter Seitenaufbau enthält nach 10 Nachläufen weiterhin Übersatz.");
            }
        }else{
            try{firstFrame.parentStory.recompose();}catch(_){}

            var guard=0,b;
            while(autoPages&&safeStoryOverflows18(storyText,lastFrame)&&guard<5000){
                for(b=0;b<batch&&guard<5000;b++){
                    page=doc.pages.add(LocationOptions.AFTER,page);
                    addRoutePageTurbo18(page,true);
                    guard++;
                }
                try{firstFrame.parentStory.recompose();}catch(_){}
                setProgress(progress,textEnd,stageName+" · "+(bulkRtfUsed?"BULK-RTF":"TURBO")+
                    " · zusätzliche Seiten "+pagesPrepared+" · Dokumentseiten "+doc.pages.length);
            }

            var fnStart=pStart+Math.round((pEnd-pStart)*0.58);
            var fnEnd=pStart+Math.round((pEnd-pStart)*0.84);
            if(!bulkRtfUsed){
                if(footPlan&&footPlan.notes&&footPlan.notes.length){
                    materializeNativeFootnotesTurbo18(storyText,footPlan,doc,footCfg,logFile,stageName,progress,fnStart,fnEnd);
                }
                if(footPlan&&footPlan.orphans&&footPlan.orphans.length){
                    materializeOrphanFootnoteMarkers18(storyText,footPlan,doc,footCfg,logFile,stageName);
                }
                try{firstFrame.parentStory.recompose();}catch(_){}
            }

            guard=0;
            while(autoPages&&safeStoryOverflows18(storyText,lastFrame)&&guard<5000){
                for(b=0;b<batch&&guard<5000;b++){
                    page=doc.pages.add(LocationOptions.AFTER,page);
                    addRoutePageTurbo18(page,true);
                    guard++;
                }
                try{firstFrame.parentStory.recompose();}catch(_){}
                setProgress(progress,fnEnd,stageName+" · TURBO · Fußnotenraum · "+pagesPrepared+
                    " Seiten · Dokumentseiten "+doc.pages.length);
            }
            if(guard>=5000&&safeStoryOverflows18(storyText,lastFrame))
                throw new Error(stageName+": TURBO-Sicherheitsabbruch nach 5000 Zusatzseiten.");
        }

        var endOffset=storyEndPageOffset18(doc,storyText);
        if(perf.trimReserve && !bulkRtfUsed && !earlyTypography && endOffset!==null && !safeStoryOverflows18(storyText,lastFrame)){
            trimTurboCreatedPages18(doc,createdPages,endOffset,logFile);
            try{firstFrame.parentStory.recompose();}catch(_){}
        }
        endOffset=storyEndPageOffset18(doc,storyText);

        if(autoPages && safeStoryOverflows18(storyText,lastFrame)){
            var postGuard=0,postBatch=Math.max(10,Math.min(100,batch*2)),b2;
            while(safeStoryOverflows18(storyText,lastFrame) && postGuard<5000){
                for(b2=0;b2<postBatch && postGuard<5000;b2++){
                    page=doc.pages.add(LocationOptions.AFTER,page);
                    addRoutePageTurbo18(page,true);
                    postGuard++;
                }
                try{firstFrame.parentStory.recompose();}catch(_){}
                setProgress(progress,pEnd-1,stageName+" · Schluss-Nachlauf · "+pagesPrepared+
                    " · Dokumentseiten "+doc.pages.length);
            }
            if(safeStoryOverflows18(storyText,lastFrame))
                throw new Error(stageName+": Story enthält nach dem automatischen Nachlauf weiterhin Übersatz.");
            endOffset=storyEndPageOffset18(doc,storyText);
        }

        var pagesUsed=(endOffset!==null)?Math.max(1,endOffset-startPageIndex+1):pagesPrepared;
        var endPage=(endOffset!==null&&endOffset<doc.pages.length)?doc.pages[endOffset]:page;

        turboPulsePagePanel18(perf);
        setProgress(progress,pEnd,stageName+" · TURBO fertig · benutzt "+pagesUsed+
            " Seiten · Dokument tatsächlich "+doc.pages.length+" Seiten");
        if(logFile)logLine(logFile,"TURBO "+stageName+" fullEstimate="+fullEstimate+
            " prepared="+pagesPrepared+" used="+pagesUsed+" docPages="+doc.pages.length+
            " earlyTypography="+earlyTypography+
            " calibratedCpp="+(calibration?calibration.charsPerPage.toFixed(2):"n/a")+
            " footnoteEngine="+(bulkRtfUsed?"BULK_RTF":"NATIVE_ADD"));

        return {
            storyText:storyText,
            pagesUsed:pagesUsed,
            nextPageIndex:(endOffset!==null?endOffset+1:findPageOffset(doc,endPage)+1),
            lastFrame:lastFrame,
            typographyApplied:earlyTypography
        };
    }

    function flowTextThroughMasterRoute18(doc,startPageIndex,text,route,opt,autoPages,progress,pStart,pEnd,logFile,stageName,footPlan,footCfg) {
        if(autoPages && shouldUseTurboImport18(text,footPlan,opt?opt.performance:null) && stageName==="BODY"){
            return flowTextThroughMasterRouteTurbo18(doc,startPageIndex,text,route,opt,autoPages,progress,pStart,pEnd,logFile,stageName,footPlan,footCfg);
        }
        var master = findMasterSpreadForRoute18(doc,route);
        if (!master || !master.isValid) throw new Error(stageName+": Musterseite „"+route.masterName+"“ wurde im Zieldokument nicht gefunden.");

        var page = ensurePageAtOffset18(doc,startPageIndex);
        var firstFrame = null, lastFrame = null, storyText = null, pagesUsed = 0, guard = 0;

        function addRoutePage18(p) {
            var frames = overrideRouteFramesOnPage18(doc,p,master,route,opt);
            var i;
            if (!frames.length) {
                throw new Error(stageName+": Auf Seite "+safeStr(getProp(p,"name"))+
                    " konnten keine gewählten Rahmen von „"+route.masterName+"“ verwendet werden.");
            }
            for (i = 0; i < frames.length; i++) {
                unlinkTextFrame18(frames[i]);
                if (lastFrame) {
                    try { lastFrame.nextTextFrame = frames[i]; }
                    catch (e) { throw new Error(stageName+": Textrahmen konnten nicht verkettet werden: "+errText(e)); }
                }
                if (!firstFrame) firstFrame = frames[i];
                lastFrame = frames[i];
            }
            pagesUsed++;
            logLine(logFile,stageName+" page="+safeStr(getProp(p,"name"))+" master="+route.masterName+" frames="+frames.length);
        }

        addRoutePage18(page);
        try { firstFrame.contents = text; }
        catch (e) { throw new Error(stageName+": Text konnte nicht in den ersten Zielrahmen geschrieben werden: "+errText(e)); }

        try { storyText = firstFrame.parentStory.texts[0]; } catch (_) { try { storyText = firstFrame.parentStory; } catch (_) {} }
        if(footPlan&&footPlan.notes&&footPlan.notes.length) materializeNativeFootnotes18(storyText,footPlan,doc,footCfg,logFile,stageName);
        if(footPlan&&footPlan.orphans&&footPlan.orphans.length) materializeOrphanFootnoteMarkers18(storyText,footPlan,doc,footCfg,logFile,stageName);
        try { firstFrame.parentStory.recompose(); } catch (_) {}

        while (autoPages && safeStoryOverflows18(storyText,lastFrame) && guard < 5000) {
            page = doc.pages.add(LocationOptions.AFTER,page);
            addRoutePage18(page);
            guard++;
            try { firstFrame.parentStory.recompose(); } catch (_) {}
            if (progress) {
                var ratio = Math.min(0.97,pagesUsed/Math.max(12,pagesUsed+8));
                setProgress(progress,pStart+Math.round(ratio*(pEnd-pStart)),
                    stageName+" · "+pagesUsed+" Seiten · "+route.masterName);
            }
        }

        if (guard >= 5000 && safeStoryOverflows18(storyText,lastFrame)) {
            throw new Error(stageName+": Sicherheitsabbruch nach 5000 zusätzlichen Seiten.");
        }

        if (!autoPages && safeStoryOverflows18(storyText,lastFrame)) {
            logLine(logFile,"WARNING "+stageName+": overset text remains; autoPages disabled");
        }

        return {
            storyText:storyText,
            pagesUsed:pagesUsed,
            nextPageIndex:findPageOffset(doc,page)+1,
            lastFrame:lastFrame
        };
    }

    function ensurePageAtOffset18(doc,index) {
        var idx = Math.max(0,Number(index)||0);
        while (doc.pages.length <= idx) doc.pages.add();
        return doc.pages[idx];
    }

    function findMasterSpreadForRoute18(doc,route) {
        var i, ms;
        try {
            ms = doc.masterSpreads.itemByName(route.masterName);
            if (ms && ms.isValid) return ms;
        } catch (_) {}
        for (i = 0; i < safeLength(doc.masterSpreads); i++) {
            try {
                ms = doc.masterSpreads[i];
                if (safeStr(getProp(ms,"name")) === safeStr(route.masterName)) return ms;
                if (route.masterPrefix && safeStr(getProp(ms,"namePrefix")) === safeStr(route.masterPrefix)) return ms;
            } catch (_) {}
        }
        return null;
    }

    function overrideRouteFramesOnPage18(doc,page,master,route,opt) {
        if (opt.masterAutoApply) {
            try {
                if (!page.appliedMaster || !page.appliedMaster.isValid || page.appliedMaster.id !== master.id) page.appliedMaster = master;
            } catch (e) {
                try { page.appliedMaster = master; }
                catch (_) { throw new Error("Musterseite „"+route.masterName+"“ konnte auf Seite "+safeStr(getProp(page,"name"))+" nicht angewendet werden."); }
            }
        } else {
            try {
                if (!page.appliedMaster || !page.appliedMaster.isValid || page.appliedMaster.id !== master.id) {
                    throw new Error("Auf Seite "+safeStr(getProp(page,"name"))+" ist „"+route.masterName+"“ nicht angewendet. Aktiviere „Musterseite automatisch anwenden“.");
                }
            } catch (e2) { throw e2; }
        }

        var mp = matchingMasterPageForDocumentPage18(master,page);
        if (!mp) throw new Error("Keine passende linke/rechte Musterseite in „"+route.masterName+"“ gefunden.");

        var masterFrames = sortedMasterTextFrames18(mp), out = [], i, slotNo, mtf, tf;
        for (i = 0; i < route.slotIndices.length; i++) {
            slotNo = Number(route.slotIndices[i]);
            if (slotNo < 1 || slotNo > masterFrames.length) continue;
            mtf = masterFrames[slotNo-1];
            tf = getOrOverrideMasterFrame18(page,mtf);
            if (!tf) continue;

            try { tf.locked = false; } catch (_) {}
            if (opt.masterClearText) {
                try { tf.contents = ""; } catch (_) {}
            }

            if (!opt.preserveMasterVisual) {
                applyFrameVisual18(tf,doc,i,{
                    enabled:!!opt.frameColors,
                    hex:opt.frameHex||[],
                    insetMm:opt.frameInsetMm||0,
                    strokePt:opt.frameStrokePt||0,
                    strokeHex:opt.frameStrokeHex||"B7C7D9"
                });
            }
            out.push(tf);
        }
        return out;
    }

    function matchingMasterPageForDocumentPage18(master,docPage) {
        var side = enumStr(getProp(docPage,"side")), pages = getProp(master,"pages"), i, p;
        for (i = 0; i < safeLength(pages); i++) {
            p = pages[i];
            if (enumStr(getProp(p,"side")) === side) return p;
        }
        if (safeLength(pages) === 1) return pages[0];
        if (side === "LEFT_HAND" && safeLength(pages) > 0) return pages[0];
        if (side === "RIGHT_HAND" && safeLength(pages) > 1) return pages[1];
        return safeLength(pages) ? pages[0] : null;
    }

    function sortedMasterTextFrames18(masterPage) {
        var frames=resolvedMasterTextFrames18(masterPage),pairs=[],out=[],i,d;
        for(i=0;i<frames.length;i++){
            try{
                d=masterFrameDescriptorLive18(frames[i],masterPage);
                pairs.push({frame:frames[i],desc:d});
            }catch(_){}
        }
        pairs.sort(function(a,b){return masterFrameDescriptorSort18(a.desc,b.desc);});
        for(i=0;i<pairs.length;i++)out.push(pairs[i].frame);
        return out;
    }

    function getOrOverrideMasterFrame18(page,masterFrame) {
        var coll = getProp(page,"textFrames"), i, tf, src;
        for (i = 0; i < safeLength(coll); i++) {
            try {
                tf = coll[i];
                if (!getProp(tf,"overridden")) continue;
                src = getProp(tf,"overriddenMasterPageItem");
                if (src && isValidObj(src) && objId(src) === objId(masterFrame)) return tf;
            } catch (_) {}
        }

        try { masterFrame.allowOverrides = true; } catch (_) {}
        try {
            tf = masterFrame.override(page);
            if (tf && isValidObj(tf)) return tf;
        } catch (e) {
            throw new Error("Musterrahmen R"+(Number(getProp(masterFrame,"index"))+1)+" konnte nicht überschrieben werden: "+errText(e));
        }
        return null;
    }

    function unlinkTextFrame18(tf) {
        if (!tf) return;
        try { tf.previousTextFrame = NothingEnum.NOTHING; } catch (_) {}
        try { tf.nextTextFrame = NothingEnum.NOTHING; } catch (_) {}
    }

    function createTitlePage18(doc,page,a,opt){
        var pb=page.bounds, mp=page.marginPreferences, top=pb[0]+Math.max(36,Number(mp.top)||36), left=pb[1]+Math.max(36,Number(mp.left)||36),
            bottom=pb[2]-Math.max(36,Number(mp.bottom)||36), right=pb[3]-Math.max(36,Number(mp.right)||36);
        var tf=page.textFrames.add(); tf.geometricBounds=[top,left,bottom,right];
        tf.contents=a.title+"\r"+(a.hebrewTitle||"")+"\r\r"+(a.publisher||"")+"\r"+(a.url||"");
        try{tf.textFramePreferences.verticalJustification=VerticalJustification.CENTER_ALIGN;}catch(_){}
        try{tf.textFramePreferences.insetSpacing=12;}catch(_){}
        if(opt && opt.frameColors){
            try{tf.fillColor=ensureRgbSwatch18(doc,(opt.frameHex&&opt.frameHex.length?opt.frameHex[0]:"D0E8FF"));}catch(_){}
        }
        var pars=tf.paragraphs;
        try{pars[0].justification=Justification.CENTER_ALIGN;pars[0].pointSize=26;pars[0].appliedFont=toolFonts().CAM_REG;}catch(_){}
        try{if(a.hebrewTitle){pars[1].justification=Justification.CENTER_ALIGN;pars[1].pointSize=30;pars[1].appliedFont=toolFonts().KET_MED;setWorldReadyComposer(pars[1]);}}catch(_){}
        var i; for(i=2;i<pars.length;i++){try{pars[i].justification=Justification.CENTER_ALIGN;pars[i].pointSize=11;pars[i].appliedFont=toolFonts().CAM_REG;}catch(_){} }
        return tf;
    }


    function flowTextAcrossPagesTurbo18(doc,startPage,text,framesPerPage,layoutMode,gapXmm,gapYmm,autoPages,clearPages,progress,pStart,pEnd,frameStyle,footPlan,footCfg,performance){
        var perf=performance||{},page=startPage,firstFrame=null,lastFrame=null,storyText=null,pagesPrepared=0;
        var createdPages=[],startIndex=findPageOffset(doc,startPage),startSectionPage=startPage;
        var estimate=perf.preallocate?turboEstimatedPages18(text,footPlan,perf):1;
        var batch=Math.max(5,Number(perf.pageBatch)||20),i,frames;

        function addGridPageTurbo18(p,created){
            if(clearPages)clearPageItems(p);
            frames=createFrameGrid18(p,framesPerPage,layoutMode,gapXmm,gapYmm,doc,frameStyle);
            for(i=0;i<frames.length;i++){
                if(lastFrame){try{lastFrame.nextTextFrame=frames[i];}catch(_){}}
                if(!firstFrame)firstFrame=frames[i];
                lastFrame=frames[i];
            }
            if(created)createdPages.push(p);
            pagesPrepared++;
        }

        addGridPageTurbo18(page,false);
        var existingIndex=startIndex+1,created=false,b;
        while(pagesPrepared<estimate){
            created=false;
            if(existingIndex<doc.pages.length&&sameSection18(startSectionPage,doc.pages[existingIndex])){
                page=doc.pages[existingIndex];existingIndex++;
            }else{
                page=doc.pages.add(LocationOptions.AFTER,page);created=true;existingIndex=findPageOffset(doc,page)+1;
            }
            addGridPageTurbo18(page,created);
            if(progress&&(pagesPrepared%batch===0||pagesPrepared===estimate)){
                setProgress(progress,pStart+Math.round((pagesPrepared/Math.max(1,estimate))*(pEnd-pStart)*0.28),
                    "TURBO · Rahmen "+pagesPrepared+" / ca. "+estimate+" Seiten");
            }
        }

        var textStart=pStart+Math.round((pEnd-pStart)*0.28),textEnd=pStart+Math.round((pEnd-pStart)*0.55);
        var bulkRtfUsed=false;
        if(shouldUseBulkRtfFootnotes18(footPlan,perf)){
            try{
                storyText=placeBulkRtfFootnotes18(firstFrame,text,footPlan,doc,footCfg,perf,null,"BODY",progress,textStart,textEnd);
                bulkRtfUsed=true;
            }catch(eBulk){
                if(!perf.bulkFootnoteFallback)throw eBulk;
            }
        }
        if(!bulkRtfUsed)storyText=insertLargeTextChunks18(firstFrame,text,perf.chunkChars,progress,textStart,textEnd,"TURBO");
        try{firstFrame.parentStory.recompose();}catch(_){}

        var guard=0;
        while(autoPages&&safeStoryOverflows18(storyText,lastFrame)&&guard<5000){
            for(b=0;b<batch&&guard<5000;b++){
                page=doc.pages.add(LocationOptions.AFTER,page);addGridPageTurbo18(page,true);guard++;
            }
            try{firstFrame.parentStory.recompose();}catch(_){}
        }

        var fnStart=pStart+Math.round((pEnd-pStart)*0.58),fnEnd=pStart+Math.round((pEnd-pStart)*0.84);
        if(!bulkRtfUsed){
            if(footPlan&&footPlan.notes&&footPlan.notes.length)
                materializeNativeFootnotesTurbo18(storyText,footPlan,doc,footCfg,null,"BODY",progress,fnStart,fnEnd);
            if(footPlan&&footPlan.orphans&&footPlan.orphans.length)
                materializeOrphanFootnoteMarkers18(storyText,footPlan,doc,footCfg,null,"BODY");
            try{firstFrame.parentStory.recompose();}catch(_){}
        }
        guard=0;
        while(autoPages&&safeStoryOverflows18(storyText,lastFrame)&&guard<5000){
            for(b=0;b<batch&&guard<5000;b++){
                page=doc.pages.add(LocationOptions.AFTER,page);addGridPageTurbo18(page,true);guard++;
            }
            try{firstFrame.parentStory.recompose();}catch(_){}
        }

        var endOffset=storyEndPageOffset18(doc,storyText);
        if(perf.trimReserve&&!bulkRtfUsed&&endOffset!==null&&!safeStoryOverflows18(storyText,lastFrame)){
            trimTurboCreatedPages18(doc,createdPages,endOffset,null);
            try{firstFrame.parentStory.recompose();}catch(_){}
        }
        endOffset=storyEndPageOffset18(doc,storyText);
        if(autoPages&&safeStoryOverflows18(storyText,lastFrame)){
            var postGuard2=0,postBatch2=Math.max(1,Math.min(20,batch));
            while(safeStoryOverflows18(storyText,lastFrame)&&postGuard2<5000){
                for(b=0;b<postBatch2&&postGuard2<5000;b++){
                    page=doc.pages.add(LocationOptions.AFTER,page);addGridPageTurbo18(page,true);postGuard2++;
                }
                try{firstFrame.parentStory.recompose();}catch(_){}
            }
            if(safeStoryOverflows18(storyText,lastFrame))throw new Error("TURBO: Story enthält nach dem Nachlauf weiterhin Übersatz.");
            endOffset=storyEndPageOffset18(doc,storyText);
        }
        var pagesUsed=endOffset!==null?Math.max(1,endOffset-startIndex+1):pagesPrepared;
        setProgress(progress,pEnd,"TURBO fertig · "+pagesUsed+" Seiten · Übersatz NEIN");
        return {storyText:storyText,pagesUsed:pagesUsed,nextPageIndex:(endOffset!==null?endOffset+1:findPageOffset(doc,page)+1)};
    }

    function flowTextAcrossPages18(doc,startPage,text,framesPerPage,layoutMode,gapXmm,gapYmm,autoPages,clearPages,progress,pStart,pEnd,frameStyle,footPlan,footCfg,performance){
        if(autoPages && shouldUseTurboImport18(text,footPlan,performance)){
            return flowTextAcrossPagesTurbo18(doc,startPage,text,framesPerPage,layoutMode,gapXmm,gapYmm,autoPages,clearPages,progress,pStart,pEnd,frameStyle,footPlan,footCfg,performance);
        }
        var page=startPage, firstFrame=null, lastFrame=null, pagesUsed=0, guard=0, storyText=null, i, frames;

        function addFlowPage(p){
            if(clearPages)clearPageItems(p);
            frames=createFrameGrid18(p,framesPerPage,layoutMode,gapXmm,gapYmm,doc,frameStyle);
            for(i=0;i<frames.length;i++){
                if(lastFrame){try{lastFrame.nextTextFrame=frames[i];}catch(_){} }
                if(!firstFrame)firstFrame=frames[i];
                lastFrame=frames[i];
            }
            pagesUsed++;
        }

        addFlowPage(page);
        firstFrame.contents=text;
        try{storyText=firstFrame.parentStory.texts[0];}catch(_){storyText=firstFrame.parentStory;}
        if(footPlan&&footPlan.notes&&footPlan.notes.length) materializeNativeFootnotes18(storyText,footPlan,doc,footCfg,null,"BODY");
        if(footPlan&&footPlan.orphans&&footPlan.orphans.length) materializeOrphanFootnoteMarkers18(storyText,footPlan,doc,footCfg,null,"BODY");
        try{firstFrame.parentStory.recompose();}catch(_){}

        while(autoPages && safeStoryOverflows18(storyText,lastFrame) && guard<5000){
            var batch=10, b;
            for(b=0;b<batch && guard<5000;b++){
                page=doc.pages.add(LocationOptions.AFTER,page);
                addFlowPage(page);
                guard++;
            }
            try{firstFrame.parentStory.recompose();}catch(_){}
            if(progress){
                var ratio=Math.min(0.97,pagesUsed/Math.max(20,pagesUsed+20));
                setProgress(progress,pStart+Math.round(ratio*(pEnd-pStart)),"Textfluss · "+pagesUsed+" Seiten angelegt");
            }
        }
        if(guard>=5000 && safeStoryOverflows18(storyText,lastFrame))throw new Error("Sicherheitsabbruch: mehr als 5000 zusätzliche Textseiten wären nötig.");
        var nextIdx=findPageOffset(doc,page)+1;
        return {storyText:storyText,pagesUsed:pagesUsed,nextPageIndex:nextIdx};
    }

    function resolveStoryForOverflow18(storyText,lastFrame){
        var st=null;
        try{
            if(storyText){
                var tc=getProp(storyText,"textContainers");
                if(tc!==null&&tc!==undefined&&getProp(storyText,"overflows")!==null)return storyText;
            }
        }catch(_){}
        try{st=getProp(storyText,"parentStory");if(st&&isValidObj(st))return st;}catch(_){}
        try{st=getProp(lastFrame,"parentStory");if(st&&isValidObj(st))return st;}catch(_){}
        return null;
    }

    function safeStoryOverflows18(storyText,lastFrame){
        var st=resolveStoryForOverflow18(storyText,lastFrame),containers,last;
        if(st){
            try{return !!st.overflows;}catch(_){}
            try{
                containers=getProp(st,"textContainers");
                if(containers&&safeLength(containers)){
                    last=containers[safeLength(containers)-1];
                    return !!getProp(last,"overflows");
                }
            }catch(_){}
        }
        return safeFrameOverflows(lastFrame);
    }

    function findLargestOversetStory18(doc){
        var stories=getProp(doc,"stories"),best=null,bestScore=-1,i,st,containers,score;
        for(i=0;i<safeLength(stories);i++){
            try{
                st=stories[i];
                if(!st||!isValidObj(st)||!st.overflows)continue;
                containers=getProp(st,"textContainers");
                score=safeLength(containers);
                if(score>bestScore){best=st;bestScore=score;}
            }catch(_){}
        }
        return best;
    }

    function lastTextContainerFrame18(story){
        var containers=getProp(story,"textContainers"),i,c;
        for(i=safeLength(containers)-1;i>=0;i--){
            try{
                c=containers[i];
                if(c&&isValidObj(c)&&getProp(c,"parentPage")&&isValidObj(getProp(c,"parentPage")))return c;
            }catch(_){}
        }
        return null;
    }

    function continueOversetStoryMaster18(doc,story,route,opt,batch,progress,logFile){
        if(!doc||!story)throw new Error("Dokument oder Story fehlt.");
        var master=findMasterSpreadForRoute18(doc,route);
        if(!master||!master.isValid)throw new Error("Musterseite „"+route.masterName+"“ wurde nicht gefunden.");
        var lastFrame=lastTextContainerFrame18(story);
        if(!lastFrame)throw new Error("Letzter Textrahmen der Übersatz-Story konnte nicht bestimmt werden.");
        var page=getProp(lastFrame,"parentPage");
        if(!page||!isValidObj(page))throw new Error("Letzte Dokumentseite der Story konnte nicht bestimmt werden.");
        var added=0,guard=0,b,frames,i;

        while(safeStoryOverflows18(story,lastFrame)&&guard<5000){
            for(b=0;b<batch&&guard<5000;b++){
                page=doc.pages.add(LocationOptions.AFTER,page);
                frames=overrideRouteFramesOnPage18(doc,page,master,route,opt);
                if(!frames.length)throw new Error("Auf neuer Seite "+safeStr(getProp(page,"name"))+" wurden keine Zielrahmen gefunden.");
                for(i=0;i<frames.length;i++){
                    unlinkTextFrame18(frames[i]);
                    try{lastFrame.nextTextFrame=frames[i];}
                    catch(e){throw new Error("Neue Textrahmen konnten nicht verkettet werden: "+errText(e));}
                    lastFrame=frames[i];
                }
                added++;guard++;
            }
            try{story.recompose();}catch(_){}
            if(progress){
                setProgress(progress,Math.min(97,5+Math.round(added/Math.max(added+10,20)*90)),
                    "Übersatz fortsetzen · "+added+" Seiten ergänzt");
            }
            if(logFile)logLine(logFile,"OVERSET repair added="+added+" stillOverflows="+safeStoryOverflows18(story,lastFrame));
        }
        if(safeStoryOverflows18(story,lastFrame))throw new Error("Sicherheitsabbruch: Story ist nach 5000 Zusatzseiten noch im Übersatz.");

        return {
            added:added,
            overflows:safeStoryOverflows18(story,lastFrame),
            lastPageName:safeStr(getProp(page,"name")),
            lastFrame:lastFrame
        };
    }

    function safeFrameOverflows(tf){try{return !!tf.overflows;}catch(_){return false;}}

    function createFrameGrid18(page,count,layoutMode,gapXmm,gapYmm,doc,frameStyle){
        var pb=page.bounds, mp=page.marginPreferences, gx=gapXmm/PT_TO_MM, gy=gapYmm/PT_TO_MM,
            top=pb[0]+(Number(mp.top)||36), bottom=pb[2]-(Number(mp.bottom)||36),
            left=pb[1]+(Number(mp.left)||36), right=pb[3]-(Number(mp.right)||36), frames=[], idx=0;

        function add(t,l,b,r){
            var tf=page.textFrames.add(); tf.geometricBounds=[t,l,b,r];
            applyFrameVisual18(tf,doc,idx,frameStyle); idx++; frames.push(tf); return tf;
        }
        function columns(n,t,b){
            var w=(right-left-gx*(n-1))/n, i;
            for(i=0;i<n;i++)add(t,left+i*(w+gx),b,left+i*(w+gx)+w);
        }
        function rows(n,l,r){
            var h=(bottom-top-gy*(n-1))/n, i;
            for(i=0;i<n;i++)add(top+i*(h+gy),l,top+i*(h+gy)+h,r);
        }

        if(count<=1){add(top,left,bottom,right);return frames;}
        if(layoutMode===0){layoutMode=(count===4)?3:1;}
        if(layoutMode===1){columns(count,top,bottom);return frames;}
        if(layoutMode===2){rows(count,left,right);return frames;}
        if(layoutMode===3){
            if(count===2){columns(2,top,bottom);return frames;}
            var w=(right-left-gx)/2, h=(bottom-top-gy)/2, r,c;
            for(r=0;r<2 && frames.length<count;r++)for(c=0;c<2 && frames.length<count;c++)add(top+r*(h+gy),left+c*(w+gx),top+r*(h+gy)+h,left+c*(w+gx)+w);
            return frames;
        }
        if(layoutMode===4){
            var hTop=(bottom-top-gy)/2;
            add(top,left,top+hTop,right);
            if(count>1){
                var rem=count-1, w2=(right-left-gx*(rem-1))/rem, i2;
                for(i2=0;i2<rem;i2++)add(top+hTop+gy,left+i2*(w2+gx),bottom,left+i2*(w2+gx)+w2);
            }
            return frames;
        }
        if(layoutMode===5){
            var hBot=(bottom-top-gy)/2, topCount=count-1, w3=(right-left-gx*(topCount-1))/topCount, i3;
            for(i3=0;i3<topCount;i3++)add(top,left+i3*(w3+gx),top+hBot,left+i3*(w3+gx)+w3);
            add(top+hBot+gy,left,bottom,right);
            return frames;
        }
        columns(count,top,bottom); return frames;
    }

    function applyFrameVisual18(tf,doc,index,style){
        if(!tf||!style)return;
        try{tf.textFramePreferences.insetSpacing=(style.insetMm||0)/PT_TO_MM;}catch(_){}
        if(!style.enabled){
            try{tf.fillColor=doc.swatches.itemByName("None");}catch(_){}
            return;
        }
        var hx=(style.hex&&style.hex.length)?style.hex[index%style.hex.length]:"D0E8FF";
        try{tf.fillColor=ensureRgbSwatch18(doc,hx);}catch(_){}
        try{
            if(style.strokePt>0){tf.strokeWeight=style.strokePt;tf.strokeColor=ensureRgbSwatch18(doc,style.strokeHex||"B7C7D9");}
            else tf.strokeWeight=0;
        }catch(_){}
    }

    function ensureRgbSwatch18(doc,hex){
        var clean=normalizeHex18(hex), name="BB_RGB_"+clean, sw=null, rgb=hexToRgb18(clean);
        try{sw=doc.colors.itemByName(name);if(sw&&sw.isValid)return sw;}catch(_){}
        try{return doc.colors.add({name:name,model:ColorModel.PROCESS,space:ColorSpace.RGB,colorValue:[rgb[0],rgb[1],rgb[2]]});}
        catch(e){
            try{sw=doc.colors.add();sw.name=name;sw.model=ColorModel.PROCESS;sw.space=ColorSpace.RGB;sw.colorValue=[rgb[0],rgb[1],rgb[2]];return sw;}
            catch(_){return doc.swatches.itemByName("None");}
        }
    }

    function normalizeHex18(hex){
        var h=String(hex||"").replace(/[^0-9A-Fa-f]/g,"").toUpperCase();
        if(h.length===3)h=h.charAt(0)+h.charAt(0)+h.charAt(1)+h.charAt(1)+h.charAt(2)+h.charAt(2);
        if(h.length!==6)h="D0E8FF";
        return h;
    }

    function hexToRgb18(hex){
        return [parseInt(hex.substr(0,2),16),parseInt(hex.substr(2,2),16),parseInt(hex.substr(4,2),16)];
    }

    function semanticGrepEscape18(v){
        return String(v||"").replace(/([\\.^$|?*+()[\]{}])/g,"\\$1");
    }

    function semanticCollect18(map){
        var g={chapter:[],prefaceHeb:[],prefaceLat:[],sectionHeb:[],sectionLat:[]},k,kind;
        for(k in map){
            if(!map.hasOwnProperty(k))continue;
            kind=map[k];
            if(kind==="chapter")g.chapter.push(k);
            else if(kind==="preface")(hasHebrew18(k)?g.prefaceHeb:g.prefaceLat).push(k);
            else if(kind==="section")(hasHebrew18(k)?g.sectionHeb:g.sectionLat).push(k);
        }
        return g;
    }

    function semanticApplyExactGroup18(textObj,values,style,maxPatternChars){
        if(!values||!values.length||!style)return 0;
        maxPatternChars=maxPatternChars||18000;
        var total=0,alts=[],len=0,i,v,esc,hits,j,p,pattern;
        function runChunk18(){
            if(!alts.length)return;
            pattern="(?m)^(?:"+alts.join("|")+")(?=\\r|$)";
            resetFindChange18();
            hits=[];
            try{
                app.findGrepPreferences.findWhat=pattern;
                hits=textObj.findGrep(false);
            }catch(_){hits=[];}
            finally{resetFindChange18();}
            for(j=0;j<hits.length;j++){
                try{
                    p=hits[j].paragraphs[0];
                    p.appliedParagraphStyle=style;
                    total++;
                }catch(_){}
            }
            alts=[];len=0;
        }
        for(i=0;i<values.length;i++){
            v=String(values[i]||"");
            if(!v||v.length>300)continue;
            esc=semanticGrepEscape18(v);
            if(alts.length&&(len+esc.length)>maxPatternChars)runChunk18();
            alts.push(esc);len+=esc.length+1;
        }
        runChunk18();
        return total;
    }

    function applySemanticStylesFast18(textObj,analysis,doc){
        if(!textObj||!analysis||!analysis.semanticMap)return 0;
        var styles=ensureSemanticStyles18(doc),g=semanticCollect18(analysis.semanticMap),n=0;
        n+=semanticApplyExactGroup18(textObj,g.chapter,styles.chapter);
        n+=semanticApplyExactGroup18(textObj,g.prefaceHeb,styles.preface);
        n+=semanticApplyExactGroup18(textObj,g.prefaceLat,styles.preface);
        n+=semanticApplyExactGroup18(textObj,g.sectionHeb,styles.sectionHeb);
        n+=semanticApplyExactGroup18(textObj,g.sectionLat,styles.sectionLat);
        return n;
    }

    function applySemanticStyles18(textObj,analysis,doc){
        if(!textObj||!analysis||!analysis.semanticMap)return;
        var styles=ensureSemanticStyles18(doc), pars=null, i, p, t, kind, key;
        try{pars=textObj.paragraphs;}catch(_){return;}
        for(i=0;i<safeLength(pars);i++){
            try{
                p=pars[i]; t=trim18(String(p.contents).replace(/[\r\n]+$/g,"")); if(!t)continue;
                key=semanticKey18(t); kind=analysis.semanticMap[key];
                if(!kind)continue;
                if(kind==="chapter"){
                    p.appliedParagraphStyle=styles.chapter;
                    applySemanticDirect18(p,"chapter",false);
                } else if(kind==="preface"){
                    p.appliedParagraphStyle=styles.preface;
                    applySemanticDirect18(p,"preface",hasHebrew18(t));
                } else if(kind==="section"){
                    var heb=hasHebrew18(t);
                    p.appliedParagraphStyle=heb?styles.sectionHeb:styles.sectionLat;
                    applySemanticDirect18(p,"section",heb);
                }
            }catch(_){}
        }
    }

    function applySemanticDirect18(p,kind,heb){
        var fonts=toolFonts();
        try{
            if(kind==="section"){
                p.appliedFont=heb?fonts.KET_MED:fonts.CAM_BOLD;
                p.pointSize=heb?17:15;
                p.justification=Justification.CENTER_ALIGN;
                p.spaceBefore=12;p.spaceAfter=8;p.keepWithNext=2;
                if(heb)setWorldReadyComposer(p);
            } else if(kind==="chapter"){
                p.appliedFont=fonts.CAM_BOLD;p.pointSize=12;
                p.justification=Justification.LEFT_ALIGN;
                p.spaceBefore=8;p.spaceAfter=5;p.keepWithNext=2;
            } else if(kind==="preface"){
                p.appliedFont=heb?fonts.KET_MED:fonts.CAM_BOLD;p.pointSize=16;
                p.justification=Justification.CENTER_ALIGN;
                p.spaceBefore=12;p.spaceAfter=8;p.keepWithNext=2;
                if(heb)setWorldReadyComposer(p);
            }
        }catch(_){}
    }

    function ensureSemanticStyles18(doc){
        var fonts=toolFonts();
        var secLat=ensureParaStyle18(doc,"BB · Abschnitt / Parashah · Latein");
        var secHeb=ensureParaStyle18(doc,"BB · Abschnitt / Parashah · Hebräisch");
        var chapter=ensureParaStyle18(doc,"BB · Chapter");
        var preface=ensureParaStyle18(doc,"BB · Vorwort / Einleitung");
        try{secLat.appliedFont=fonts.CAM_BOLD;secLat.pointSize=15;secLat.justification=Justification.CENTER_ALIGN;secLat.spaceBefore=12;secLat.spaceAfter=8;secLat.keepWithNext=2;}catch(_){}
        try{secHeb.appliedFont=fonts.KET_MED;secHeb.pointSize=17;secHeb.justification=Justification.CENTER_ALIGN;secHeb.spaceBefore=12;secHeb.spaceAfter=8;secHeb.keepWithNext=2;setWorldReadyComposer(secHeb);}catch(_){}
        try{chapter.appliedFont=fonts.CAM_BOLD;chapter.pointSize=12;chapter.justification=Justification.LEFT_ALIGN;chapter.spaceBefore=8;chapter.spaceAfter=5;chapter.keepWithNext=2;}catch(_){}
        try{preface.appliedFont=fonts.CAM_BOLD;preface.pointSize=16;preface.justification=Justification.CENTER_ALIGN;preface.spaceBefore=12;preface.spaceAfter=8;preface.keepWithNext=2;}catch(_){}
        return {sectionLat:secLat,sectionHeb:secHeb,chapter:chapter,preface:preface};
    }

    function ensureParaStyle18(doc,name){
        var st=null;
        try{st=doc.paragraphStyles.itemByName(name);if(st&&st.isValid)return st;}catch(_){}
        return doc.paragraphStyles.add({name:name});
    }

    function hasHebrew18(s){return /[\u0590-\u05FF\uFB1D-\uFB4F]/.test(String(s||""));}

    function frameLayoutName18(mode){
        if(mode===1)return "nebeneinander";
        if(mode===2)return "untereinander";
        if(mode===3)return "2 × 2";
        if(mode===4)return "1 oben + Rest unten";
        if(mode===5)return "Rest oben + 1 unten";
        return "automatisch";
    }

    function trim18(s){return String(s||"").replace(/^\s+|\s+$/g,"");}
    function sanitizeFileName(s){return String(s||"Neues_Dokument").replace(/[\\\/:*?"<>|]+/g,"_").replace(/^\s+|\s+$/g,"")||"Neues_Dokument";}

    // ---------------- Scan ----------------

    function scanPage(page, physicalNo, isMaster, opt, warnings) {
        var out = {
            physicalPage: physicalNo,
            pageName: safeStr(getProp(page, "name")),
            side: enumStr(getProp(page, "side")),
            bounds: bounds(getProp(page, "bounds")),
            appliedMaster: null,
            margins: marginPrefs(getProp(page, "marginPreferences")),
            frames: []
        };

        if (!isMaster) {
            var am = getProp(page, "appliedMaster");
            out.appliedMaster = masterInfo(am);
        }

        if (opt.textFrames) scanCollection(getProp(page, "textFrames"), "TextFrame", page, isMaster, opt, out.frames, warnings);
        if (opt.shapes) {
            scanCollection(getProp(page, "rectangles"), "Rectangle", page, isMaster, opt, out.frames, warnings);
            scanCollection(getProp(page, "ovals"), "Oval", page, isMaster, opt, out.frames, warnings);
            scanCollection(getProp(page, "polygons"), "Polygon", page, isMaster, opt, out.frames, warnings);
        }
        if (opt.lines) scanCollection(getProp(page, "graphicLines"), "GraphicLine", page, isMaster, opt, out.frames, warnings);
        if (opt.groups) scanCollection(getProp(page, "groups"), "Group", page, isMaster, opt, out.frames, warnings);
        return out;
    }

    function scanMaster(ms, opt, warnings) {
        var out = {
            name: safeStr(getProp(ms, "name")),
            id: objId(ms),
            prefix: safeStr(getProp(ms, "namePrefix")),
            basedOn: masterInfo(getProp(ms, "appliedMaster")),
            pages: []
        };
        var pages = getProp(ms, "pages");
        if (!pages) return out;
        var i, len = safeLength(pages);
        for (i = 0; i < len; i++) {
            try { out.pages.push(scanPage(pages[i], i + 1, true, opt, warnings)); }
            catch (e) { warnings.push("Musterseite " + out.name + ", Seite " + (i+1) + ": " + errText(e)); }
        }
        return out;
    }

    function scanCollection(coll, type, page, isMaster, opt, out, warnings) {
        if (!coll) return;
        var len = safeLength(coll);
        var i;
        for (i = 0; i < len; i++) {
            try { out.push(scanItem(coll[i], type, page, isMaster, opt)); }
            catch (e) { warnings.push(type + " auf Seite " + safeStr(getProp(page, "name")) + ": " + errText(e)); }
        }
    }

    function scanItem(item, type, page, isMaster, opt) {
        var gb = bounds(getProp(item, "geometricBounds"));
        var pageB = bounds(getProp(page, "bounds"));
        var out = {
            type: type,
            id: objId(item),
            name: safeStr(getProp(item, "name")),
            label: safeStr(getProp(item, "label")),
            layer: objName(getProp(item, "itemLayer")),
            bounds: gb,
            pageRelativeBounds: relative(gb, pageB),
            rotationAngle: safeNum(getProp(item, "rotationAngle")),
            fillColor: objName(getProp(item, "fillColor")),
            strokeColor: objName(getProp(item, "strokeColor")),
            strokeWeight: measure(getProp(item, "strokeWeight")),
            objectStyle: objName(getProp(item, "appliedObjectStyle"))
        };

        if (type === "TextFrame") {
            out.textFrame = textFrameLite(item, isMaster, opt);
        }
        return out;
    }

    function textFrameLite(tf, isMaster, opt) {
        var p = getProp(tf, "textFramePreferences");
        var out = {
            columns: safeNum(getProp(p, "textColumnCount")),
            columnGutter: measure(getProp(p, "textColumnGutter")),
            insetSpacing: measureArray(getProp(p, "insetSpacing")),
            verticalJustification: enumStr(getProp(p, "verticalJustification")),
            firstBaselineOffset: enumStr(getProp(p, "firstBaselineOffset")),
            autoSizingType: enumStr(getProp(p, "autoSizingType")),
            masterTextPreview: null,
            possibleAutoPageNumber: false,
            masterTypography: null
        };

        // Only master text frames may expose their short content.
        // We deliberately NEVER read contents on normal document text frames.
        if (isMaster && opt.includeMasterTextContents) {
            try {
                var raw = tf.contents;
                var s = safeStr(raw);
                var hasAutoPageNumber = false;

                // InDesign 18.x often exposes AUTO_PAGE_NUMBER in tf.contents
                // as the raw control character U+0018 instead of a readable token.
                try {
                    if (raw === SpecialCharacters.AUTO_PAGE_NUMBER) hasAutoPageNumber = true;
                } catch (_) {}
                if (containsCharCode(s, 24) || s.indexOf("AUTO_PAGE_NUMBER") >= 0) {
                    hasAutoPageNumber = true;
                }

                if (hasAutoPageNumber) {
                    out.possibleAutoPageNumber = true;
                    s = replaceCharCode(s, 24, "[AUTO_PAGE_NUMBER]");
                }

                // Never allow raw JSON control characters into the report.
                s = printableControlChars(s);

                if (s.length > 120) s = s.substr(0, 120) + "…";
                out.masterTextPreview = s;
            } catch (_) {}
        }

        // LITE+ extension: read typography ONLY on parent/master-page text frames.
        // No normal document-page text frame is touched here.
        if (isMaster && opt.includeMasterTypography) {
            try { out.masterTypography = masterTypographyLite(tf); } catch (_) {}
        }
        return out;
    }

    function masterTypographyLite(tf) {
        var para = null;
        var paraSource = null;
        var charSource = null;
        var insertionPoint = null;
        var sourceName = null;

        // One paragraph and at most ONE character. This deliberately avoids any loop
        // through stories, characters, paragraphs or textStyleRanges.
        try {
            if (tf.paragraphs && tf.paragraphs.length > 0) para = tf.paragraphs[0];
        } catch (_) {}
        try {
            if (tf.insertionPoints && tf.insertionPoints.length > 0) insertionPoint = tf.insertionPoints[0];
        } catch (_) {}
        try {
            if (tf.characters && tf.characters.length > 0) {
                charSource = tf.characters[0];
                sourceName = "firstCharacter";
            }
        } catch (_) {}
        if (!charSource && insertionPoint) {
            charSource = insertionPoint;
            sourceName = "firstInsertionPoint";
        }
        if (!charSource && para) {
            charSource = para;
            sourceName = "firstParagraph";
        }

        // Empty master text frames often have no Paragraph object yet, but the first
        // insertion point still carries paragraph formatting. Use it as a safe fallback.
        paraSource = para || insertionPoint;

        var out = {
            source: sourceName,
            paragraphSource: para ? "firstParagraph" : (insertionPoint ? "firstInsertionPoint" : null),
            paragraph: null,
            character: null
        };

        if (paraSource) {
            out.paragraph = {
                appliedParagraphStyle: objName(getProp(paraSource, "appliedParagraphStyle")),
                justification: enumStr(getProp(paraSource, "justification")),
                composer: safeNullableStr(getProp(paraSource, "composer")),
                leftIndent: measure(getProp(paraSource, "leftIndent")),
                rightIndent: measure(getProp(paraSource, "rightIndent")),
                firstLineIndent: measure(getProp(paraSource, "firstLineIndent")),
                spaceBefore: measure(getProp(paraSource, "spaceBefore")),
                spaceAfter: measure(getProp(paraSource, "spaceAfter")),
                hyphenation: safeBoolOrNull(getProp(paraSource, "hyphenation")),
                keepWithNext: safeNum(getProp(paraSource, "keepWithNext")),
                keepAllLinesTogether: safeBoolOrNull(getProp(paraSource, "keepAllLinesTogether"))
            };
        }

        if (charSource) {
            var ps = typographicValue(getProp(charSource, "pointSize"));
            var lead = leadingValue(getProp(charSource, "leading"), charSource, ps);
            out.character = {
                appliedFont: fontName(getProp(charSource, "appliedFont")),
                fontStyle: safeNullableStr(getProp(charSource, "fontStyle")),
                pointSize: ps,
                leading: lead,
                appliedCharacterStyle: objName(getProp(charSource, "appliedCharacterStyle")),
                fillColor: objName(getProp(charSource, "fillColor")),
                strokeColor: objName(getProp(charSource, "strokeColor")),
                tracking: safeNum(getProp(charSource, "tracking")),
                horizontalScale: safeNum(getProp(charSource, "horizontalScale")),
                verticalScale: safeNum(getProp(charSource, "verticalScale")),
                baselineShift: typographicValue(getProp(charSource, "baselineShift")),
                capitalization: enumStr(getProp(charSource, "capitalization")),
                position: enumStr(getProp(charSource, "position")),
                language: objName(getProp(charSource, "appliedLanguage"))
            };
        }
        return out;
    }

    function fontName(v) {
        if (!v) return null;
        var n = safeNullableStr(getProp(v, "fullName"));
        if (n) return n;
        n = safeNullableStr(getProp(v, "name"));
        if (n) return n;
        return safeNullableStr(v);
    }

    function typographicValue(v) {
        if (v === null || v === undefined) return null;
        var n = safeNum(v);
        if (n !== null) return { value: round6(n), unit: "pt" };
        var e = enumStr(v);
        return e ? { value: e, unit: null } : null;
    }

    function leadingValue(v, source, pointSizeObj) {
        if (v === null || v === undefined) return null;

        var isAuto = false;
        try { if (v === Leading.AUTO) isAuto = true; } catch (_) {}
        try {
            if (!isAuto && typeof Leading !== "undefined" && Number(v) === Number(Leading.AUTO)) isAuto = true;
        } catch (_) {}
        // InDesign 18.1 ExtendScript serializes Leading.AUTO numerically as 1635019116.
        // Keep this fallback so the JSON never reports that enum as billions of points.
        try { if (!isAuto && Number(v) === 1635019116) isAuto = true; } catch (_) {}

        if (isAuto) {
            var pct = safeNum(getProp(source, "autoLeading"));
            var effective = null;
            if (pct !== null && pointSizeObj && typeof pointSizeObj.value === "number") {
                effective = round6(pointSizeObj.value * pct / 100.0);
            }
            return {
                value: "AUTO",
                unit: null,
                autoLeadingPercent: pct,
                effectivePt: effective
            };
        }

        return typographicValue(v);
    }

    function safeNullableStr(v) {
        if (v === null || v === undefined) return null;
        var s = safeStr(v);
        return s === "" ? null : s;
    }

    function safeBoolOrNull(v) {
        if (v === null || v === undefined) return null;
        try { return Boolean(v); } catch (_) { return null; }
    }

    function containsCharCode(s, code) {
        s = String(s);
        var i;
        for (i = 0; i < s.length; i++) {
            if (s.charCodeAt(i) === code) return true;
        }
        return false;
    }

    function replaceCharCode(s, code, replacement) {
        s = String(s);
        var out = "", i, c;
        for (i = 0; i < s.length; i++) {
            c = s.charCodeAt(i);
            out += (c === code) ? replacement : s.charAt(i);
        }
        return out;
    }

    function printableControlChars(s) {
        s = String(s);
        var out = "", i, c, h;
        for (i = 0; i < s.length; i++) {
            c = s.charCodeAt(i);
            if (c < 32 && c !== 9 && c !== 10 && c !== 13) {
                h = c.toString(16).toUpperCase();
                while (h.length < 4) h = "0" + h;
                out += "[U+" + h + "]";
            } else {
                out += s.charAt(i);
            }
        }
        return out;
    }

    function buildSectionCatalogFromDocument18(doc,startPhysical,endPhysical){
        var out=[],sections=getProp(doc,"sections"),i,sec,startOff,len,endOff,ps,ep,info,styleCount={};
        for(i=0;i<safeLength(sections);i++){
            try{
                sec=sections[i];ps=getProp(sec,"pageStart");startOff=safeNum(getProp(ps,"documentOffset"));if(startOff===null)startOff=findPageOffset(doc,ps);
                len=safeNum(getProp(sec,"length"));endOff=(startOff!==null&&len!==null&&len>0)?startOff+len-1:null;
                if(startPhysical!==null&&startPhysical!==undefined&&endPhysical!==null&&endPhysical!==undefined&&startOff!==null&&endOff!==null){if(endOff+1<startPhysical||startOff+1>endPhysical)continue;}
                try{ep=(endOff!==null&&endOff>=0&&endOff<doc.pages.length)?doc.pages[endOff]:null;}catch(_){ep=null;}
                info=pageNumberStyleInfo(getProp(sec,"pageNumberStyle"));var sn=info&&info.name?info.name:enumStr(getProp(sec,"pageNumberStyle"));styleCount[sn]=(styleCount[sn]||0)+1;
                out.push({index:i+1,id:objId(sec),styleName:sn,styleRaw:info?info.raw:null,styleOrdinal:styleCount[sn],startPhysicalPage:startOff!==null?startOff+1:null,endPhysicalPage:endOff!==null?endOff+1:null,startPageName:safeNullableStr(getProp(ps,"name")),endPageName:safeNullableStr(getProp(ep,"name")),pageNumberStartConfigured:safeNum(getProp(sec,"pageNumberStart")),continueNumbering:safeBoolOrNull(getProp(sec,"continueNumbering"))});
            }catch(_){}
        }
        return out;
    }
    function buildSectionCatalogFromReport18(report,onlySelected){
        var out=[],src=report&&report.sections?report.sections:[],i,sn,styleCount={};
        for(i=0;i<src.length;i++){
            var r=src[i];if(onlySelected&&r.intersectsSelectedPageRange===false)continue;sn=r.pageNumberStyle&&r.pageNumberStyle.name?r.pageNumberStyle.name:"UNBEKANNT";styleCount[sn]=(styleCount[sn]||0)+1;
            out.push({index:r.index,id:r.id,styleName:sn,styleRaw:r.pageNumberStyle?r.pageNumberStyle.raw:null,styleOrdinal:styleCount[sn],startPhysicalPage:r.startPhysicalPage,endPhysicalPage:r.endPhysicalPage,startPageName:r.startPageName,endPageName:r.endPageName,pageNumberStartConfigured:r.pageNumberStartConfigured,continueNumbering:r.continueNumbering});
        }
        return out;
    }

    // ---------------- Sections / page numbering ----------------

    function scanSections(doc, selectedStart, selectedEnd, warnings) {
        var out = [];
        var sections = getProp(doc, "sections");
        if (!sections) return out;
        var len = safeLength(sections), i;
        for (i = 0; i < len; i++) {
            try { out.push(scanSection(sections[i], doc, i, selectedStart, selectedEnd)); }
            catch (e) { warnings.push("Abschnitt " + (i + 1) + ": " + errText(e)); }
        }
        return out;
    }

    function scanSection(sec, doc, zeroIndex, selectedStart, selectedEnd) {
        var startPage = getProp(sec, "pageStart");
        var startOffset = safeNum(getProp(startPage, "documentOffset"));
        if (startOffset === null) startOffset = findPageOffset(doc, startPage);

        var len = safeNum(getProp(sec, "length"));
        if (len === null || len < 0) len = null;

        var endOffset = null;
        var endPage = null;
        if (startOffset !== null && len !== null && len > 0) {
            endOffset = startOffset + len - 1;
            try {
                if (endOffset >= 0 && endOffset < doc.pages.length) endPage = doc.pages[endOffset];
            } catch (_) {}
        }

        var continueNumbering = safeBoolOrNull(getProp(sec, "continueNumbering"));
        var configuredStart = safeNum(getProp(sec, "pageNumberStart"));
        var style = pageNumberStyleInfo(getProp(sec, "pageNumberStyle"));

        var intersects = null;
        if (startOffset !== null && endOffset !== null) {
            intersects = (endOffset >= selectedStart && startOffset <= selectedEnd);
        }

        return {
            index: zeroIndex + 1,
            id: objId(sec),
            name: safeNullableStr(getProp(sec, "name")),
            startPhysicalPage: startOffset !== null ? startOffset + 1 : null,
            startPageName: safeNullableStr(getProp(startPage, "name")),
            endPhysicalPage: endOffset !== null ? endOffset + 1 : null,
            endPageName: safeNullableStr(getProp(endPage, "name")),
            length: len,
            intersectsSelectedPageRange: intersects,
            pageNumberStyle: style,
            continueNumbering: continueNumbering,
            pageNumberStartConfigured: configuredStart,
            pageNumberStartEffective: continueNumbering === false ? configuredStart : null,
            includeSectionPrefix: safeBoolOrNull(getProp(sec, "includeSectionPrefix")),
            sectionPrefix: safeNullableStr(getProp(sec, "sectionPrefix")),
            marker: safeNullableStr(getProp(sec, "marker")),
            alternateLayout: safeNullableStr(getProp(sec, "alternateLayout")),
            label: safeNullableStr(getProp(sec, "label"))
        };
    }

    function findPageOffset(doc, page) {
        if (!page || !isValidObj(page)) return null;
        var id = objId(page), i, len = doc.pages.length;
        for (i = 0; i < len; i++) {
            try {
                if (id !== null && objId(doc.pages[i]) === id) return i;
                if (doc.pages[i] === page) return i;
            } catch (_) {}
        }
        return null;
    }

    function pageNumberStyleInfo(v) {
        if (v === null || v === undefined) return null;
        var raw = safeNum(v);
        var s = enumStr(v);
        var name = null;
        var sample = null;

        if (s) {
            if (s.indexOf("UPPER_ROMAN") >= 0) name = "UPPER_ROMAN";
            else if (s.indexOf("LOWER_ROMAN") >= 0) name = "LOWER_ROMAN";
            else if (s.indexOf("UPPER_LETTERS") >= 0) name = "UPPER_LETTERS";
            else if (s.indexOf("LOWER_LETTERS") >= 0) name = "LOWER_LETTERS";
            else if (s.indexOf("SINGLE_LEADING_ZEROS") >= 0) name = "SINGLE_LEADING_ZEROS";
            else if (s.indexOf("DOUBLE_LEADING_ZEROS") >= 0) name = "DOUBLE_LEADING_ZEROS";
            else if (s.indexOf("TRIPLE_LEADING_ZEROS") >= 0) name = "TRIPLE_LEADING_ZEROS";
            else if (s.indexOf("HEBREW_BIBLICAL") >= 0) name = "HEBREW_BIBLICAL";
            else if (s.indexOf("HEBREW_NON_STANDARD") >= 0) name = "HEBREW_NON_STANDARD";
            else if (s.indexOf("ARABIC_ALIF_BA_TAH") >= 0) name = "ARABIC_ALIF_BA_TAH";
            else if (s.indexOf("ARABIC_ABJAD") >= 0) name = "ARABIC_ABJAD";
            else if (s.indexOf("ARABIC") >= 0) name = "ARABIC";
        }

        // Numeric fallbacks documented by Adobe; useful because ExtendScript 18.1
        // sometimes stringifies enumerators as numbers instead of readable names.
        if (!name && raw !== null) {
            if (raw === 1297247605) name = "UPPER_ROMAN";
            else if (raw === 1297247596) name = "LOWER_ROMAN";
            else if (raw === 1296855669) name = "UPPER_LETTERS";
            else if (raw === 1296855660) name = "LOWER_LETTERS";
            else if (raw === 1298231906) name = "ARABIC";
            else if (raw === 1297312890) name = "SINGLE_LEADING_ZEROS";
            else if (raw === 1296329850) name = "DOUBLE_LEADING_ZEROS";
            else if (raw === 1297378426) name = "TRIPLE_LEADING_ZEROS";
            else if (raw === 1296589410) name = "HEBREW_BIBLICAL";
            else if (raw === 1296589422) name = "HEBREW_NON_STANDARD";
            else if (raw === 1296130420) name = "ARABIC_ALIF_BA_TAH";
            else if (raw === 1296130410) name = "ARABIC_ABJAD";
        }

        if (name === "UPPER_ROMAN") sample = "I, II, III, …";
        else if (name === "LOWER_ROMAN") sample = "i, ii, iii, …";
        else if (name === "UPPER_LETTERS") sample = "A, B, C, …";
        else if (name === "LOWER_LETTERS") sample = "a, b, c, …";
        else if (name === "ARABIC") sample = "1, 2, 3, …";
        else if (name === "SINGLE_LEADING_ZEROS") sample = "01, 02, 03, …";
        else if (name === "DOUBLE_LEADING_ZEROS") sample = "001, 002, 003, …";
        else if (name === "TRIPLE_LEADING_ZEROS") sample = "0001, 0002, 0003, …";

        return {
            name: name || s,
            raw: raw,
            sample: sample
        };
    }

    // ---------------- Masters ----------------

    function addMasterUnique(ms, arr, keys) {
        if (!ms || !isValidObj(ms)) return;
        var key = masterKey(ms);
        if (!key || keys[key]) return;
        keys[key] = true;
        arr.push(ms);
    }

    function addMasterChain(ms, arr, keys) {
        var guard = 0;
        var cur = ms;
        while (cur && isValidObj(cur) && guard < 20) {
            addMasterUnique(cur, arr, keys);
            cur = getProp(cur, "appliedMaster");
            guard++;
        }
    }

    function masterKey(ms) {
        var id = objId(ms);
        if (id !== null) return "id:" + id;
        var n = safeStr(getProp(ms, "name"));
        return n ? "name:" + n : null;
    }

    function masterInfo(ms) {
        if (!ms || !isValidObj(ms)) return null;
        return { id: objId(ms), name: safeStr(getProp(ms, "name")) };
    }

    // ---------------- Geometry ----------------

    function bounds(v) {
        if (!v) return null;
        try {
            if (v.length < 4) return null;
            var t = safeNum(v[0]), l = safeNum(v[1]), b = safeNum(v[2]), r = safeNum(v[3]);
            if (t === null || l === null || b === null || r === null) return null;
            return {
                topPt: round6(t), leftPt: round6(l), bottomPt: round6(b), rightPt: round6(r),
                topMm: round4(t * PT_TO_MM), leftMm: round4(l * PT_TO_MM), bottomMm: round4(b * PT_TO_MM), rightMm: round4(r * PT_TO_MM),
                widthPt: round6(r-l), heightPt: round6(b-t),
                widthMm: round4((r-l)*PT_TO_MM), heightMm: round4((b-t)*PT_TO_MM)
            };
        } catch (_) { return null; }
    }

    function relative(g, p) {
        if (!g || !p) return null;
        var t = g.topPt - p.topPt, l = g.leftPt - p.leftPt;
        var b = g.bottomPt - p.topPt, r = g.rightPt - p.leftPt;
        return {
            topPt: round6(t), leftPt: round6(l), bottomPt: round6(b), rightPt: round6(r),
            topMm: round4(t*PT_TO_MM), leftMm: round4(l*PT_TO_MM), bottomMm: round4(b*PT_TO_MM), rightMm: round4(r*PT_TO_MM)
        };
    }

    function marginPrefs(p) {
        if (!p) return null;
        return {
            top: measure(getProp(p, "top")),
            bottom: measure(getProp(p, "bottom")),
            left: measure(getProp(p, "left")),
            right: measure(getProp(p, "right")),
            columnCount: safeNum(getProp(p, "columnCount")),
            columnGutter: measure(getProp(p, "columnGutter"))
        };
    }

    function measure(v) {
        var n = safeNum(v);
        if (n === null) return null;
        return { pt: round6(n), mm: round4(n * PT_TO_MM) };
    }

    function measureArray(v) {
        if (!v) return null;
        try {
            var a = [], i;
            for (i = 0; i < v.length; i++) a.push(measure(v[i]));
            return a;
        } catch (_) { return null; }
    }

    // ---------------- Progress / log ----------------

    function createProgress() {
        var p = new Window("palette", SCRIPT_NAME);
        p.orientation = "column";
        p.alignChildren = "fill";
        p.margins = 12;
        p.t = p.add("statictext", undefined, "Start …");
        p.t.preferredSize.width = 470;
        p.b = p.add("progressbar", undefined, 0, 100);
        p.b.preferredSize.width = 470;
        return p;
    }

    function setProgress(p, val, text) {
        try {
            p.b.value = val;
            p.t.text = text;
            p.update();
        } catch (_) {}
    }

    function openLog(f) {
        f.encoding = "UTF-8";
        f.lineFeed = "Unix";
        if (!f.open("w")) throw new Error("Logdatei kann nicht erstellt werden.");
    }
    function logLine(f, s) {
        if (!f) return;
        try { f.writeln(isoNow() + "  " + s); f.flush(); } catch (_) {}
    }
    function closeLog(f) { try { if (f) f.close(); } catch (_) {} }

    // ---------------- Safe helpers ----------------

    function getProp(o, p) {
        if (!o) return null;
        try {
            var v = o[p];
            try { if (v === NothingEnum.NOTHING) return null; } catch (_) {}
            return v;
        } catch (_) { return null; }
    }

    function isValidObj(o) {
        if (!o) return false;
        try { if (o === NothingEnum.NOTHING) return false; } catch (_) {}
        try { return o.isValid !== false; } catch (_) { return true; }
    }

    function safeLength(c) {
        try { return Number(c.length) || 0; } catch (_) { return 0; }
    }

    function objId(o) {
        var n = safeNum(getProp(o, "id"));
        return n;
    }

    function objName(o) {
        if (!o) return null;
        var n = safeStr(getProp(o, "name"));
        if (n) return n;
        return enumStr(o);
    }

    function safeStr(v) {
        if (v === null || v === undefined) return "";
        try { return String(v); } catch (_) { return ""; }
    }

    function safeNum(v) {
        if (v === null || v === undefined) return null;
        try {
            var n = Number(v);
            if (isNaN(n) || !isFinite(n)) return null;
            return n;
        } catch (_) { return null; }
    }

    function safeBool(v) {
        if (v === null || v === undefined) return null;
        return v === true;
    }

    function enumStr(v) {
        if (v === null || v === undefined) return null;
        try {
            var s = String(v);
            if (s === "NothingEnum.NOTHING") return null;
            return s;
        } catch (_) { return null; }
    }

    function clamp(v, min, max) {
        v = Number(v);
        if (isNaN(v)) v = min;
        if (v < min) return min;
        if (v > max) return max;
        return v;
    }
    function round4(n) { return Math.round(n * 10000) / 10000; }
    function round6(n) { return Math.round(n * 1000000) / 1000000; }

    // ---------------- File / JSON ----------------

    // ---------------- OpenAI Responses API helpers (v2.6) ----------------

    function openAIResponsesText18(cfg,prompt,maxOutputTokens){
        if(!cfg)throw new Error("OpenAI-Konfiguration fehlt.");
        var key="";
        if(cfg.useEnvironment){
            try{key=$.getenv("OPENAI_API_KEY")||"";}catch(_){key="";}
            if(!key)throw new Error("OPENAI_API_KEY ist in der Umgebung nicht gesetzt. Alternativ das Sitzungsfeld im KI-Reiter verwenden.");
        } else {
            key=trim18(cfg.apiKey);
            if(!key)throw new Error("Kein OpenAI API-Key eingegeben.");
        }

        var endpoint=trim18(cfg.endpoint||"https://api.openai.com/v1/responses");
        if(!/^https:\/\//i.test(endpoint))throw new Error("OpenAI Endpoint muss mit https:// beginnen.");

        var tokenLimit=parseInt(maxOutputTokens,10);
        if(isNaN(tokenLimit)||tokenLimit<16)tokenLimit=1200;

        var requestObj={
            model:trim18(cfg.model||"gpt-5-mini"),
            input:String(prompt||""),
            store:false,
            max_output_tokens:tokenLimit
        };

        var stamp=String(new Date().getTime())+"_"+Math.floor(Math.random()*100000);
        var reqFile=new File(Folder.temp.fsName+"/id_openai_req_"+stamp+".json");
        var resFile=new File(Folder.temp.fsName+"/id_openai_res_"+stamp+".json");
        var cfgFile=new File(Folder.temp.fsName+"/id_openai_curl_"+stamp+".cfg");
        var errFile=new File(Folder.temp.fsName+"/id_openai_err_"+stamp+".txt");

        function curlCfgEscape18(v){return String(v||"").replace(/\\/g,"/").replace(/"/g,'\\"');}
        function shellQuoteWin18(v){return '"'+String(v||"").replace(/"/g,'""')+'"';}
        function shellQuotePosix18(v){return "'"+String(v||"").replace(/'/g,"'\\''")+"'";}

        try{
            writeUTF8(reqFile,jsonStringify(requestObj));
            var curlCfg=
                'url = "'+curlCfgEscape18(endpoint)+'"\n'+
                'request = "POST"\n'+
                'header = "Content-Type: application/json"\n'+
                'header = "Authorization: Bearer '+curlCfgEscape18(key)+'"\n'+
                'data-binary = "@'+curlCfgEscape18(reqFile.fsName)+'"\n'+
                'output = "'+curlCfgEscape18(resFile.fsName)+'"\n'+
                'silent\nshow-error\nfail-with-body\n'+
                'max-time = 180\n';
            writeUTF8(cfgFile,curlCfg);

            var osName="";
            try{osName=String($.os||"").toLowerCase();}catch(_){}
            var cmd;
            if(osName.indexOf("windows")>=0){
                cmd='cmd.exe /V:OFF /C curl.exe --config '+shellQuoteWin18(cfgFile.fsName)+' 2> '+shellQuoteWin18(errFile.fsName);
            } else {
                cmd='/usr/bin/curl --config '+shellQuotePosix18(cfgFile.fsName)+' 2> '+shellQuotePosix18(errFile.fsName);
            }
            try{system.callSystem(cmd);}catch(e){throw new Error("curl konnte nicht gestartet werden: "+errText(e));}

            var errTextFile="";
            try{if(errFile.exists)errTextFile=readUTF8(errFile);}catch(_){}
            if(!resFile.exists){
                throw new Error("Keine Antwortdatei von OpenAI erhalten."+(errTextFile?"\n\ncurl: "+errTextFile:""));
            }
            var raw=readUTF8(resFile), obj;
            try{obj=jsonParse(raw);}catch(e){throw new Error("OpenAI-Antwort ist kein gültiges JSON.\n\n"+raw.substr(0,1200));}
            if(obj&&obj.error){
                throw new Error((obj.error.message||"OpenAI API Fehler")+(obj.error.type?"\nTyp: "+obj.error.type:""));
            }
            var text=extractOpenAIOutputText18(obj);
            if(!trim18(text)){
                throw new Error("OpenAI hat keine Textausgabe geliefert."+(errTextFile?"\n\ncurl: "+errTextFile:""));
            }
            return text;
        } finally {
            // The temporary curl config contains the session key and is deleted immediately.
            try{if(reqFile.exists)reqFile.remove();}catch(_){}
            try{if(resFile.exists)resFile.remove();}catch(_){}
            try{if(cfgFile.exists)cfgFile.remove();}catch(_){}
            try{if(errFile.exists)errFile.remove();}catch(_){}
            key="";
        }
    }

    function extractOpenAIOutputText18(obj){
        if(!obj)return "";
        var out=[],i,j,item,part;
        try{
            if(obj.output&&obj.output.length){
                for(i=0;i<obj.output.length;i++){
                    item=obj.output[i];
                    if(!item||!item.content)continue;
                    for(j=0;j<item.content.length;j++){
                        part=item.content[j];
                        if(part&&part.type==="output_text"&&part.text!==undefined)out.push(String(part.text));
                    }
                }
            }
        }catch(_){}
        return out.join("");
    }

    function readUTF8(f) {
        f.encoding = "UTF-8";
        if (!f.open("r")) throw new Error("Datei kann nicht gelesen werden: " + f.fsName);
        var s = f.read();
        f.close();
        return s;
    }

    function jsonParse(s) {
        try { return eval("(" + s + ")"); } catch (e) { throw new Error("JSON konnte nicht gelesen werden: " + errText(e)); }
    }

    function writeUTF8(f, s) {
        f.encoding = "UTF-8";
        f.lineFeed = "Unix";
        if (!f.open("w")) throw new Error("JSON-Datei kann nicht geschrieben werden: " + f.fsName);
        try { f.write(s); } finally { f.close(); }
    }

    function jsonStringify(value) {
        // Deliberately use our own tiny serializer.
        // ExtendScript/InDesign may expose text special characters as raw U+0000..U+001F;
        // all of them must be escaped for standards-compliant JSON.
        function q(value) {
            var str = String(value);
            var out = '"', i, ch, code, hex;
            for (i = 0; i < str.length; i++) {
                ch = str.charAt(i);
                code = str.charCodeAt(i);
                if (ch === "\\") out += "\\\\";
                else if (ch === '"') out += '\\"';
                else if (code === 8) out += "\\b";
                else if (code === 9) out += "\\t";
                else if (code === 10) out += "\\n";
                else if (code === 12) out += "\\f";
                else if (code === 13) out += "\\r";
                else if (code < 32) {
                    hex = code.toString(16);
                    while (hex.length < 4) hex = "0" + hex;
                    out += "\\u" + hex;
                } else {
                    out += ch;
                }
            }
            return out + '"';
        }
        function s(v) {
            if (v === null || v === undefined) return "null";
            var t = typeof v;
            if (t === "string") return q(v);
            if (t === "number") return isFinite(v) ? String(v) : "null";
            if (t === "boolean") return v ? "true" : "false";
            if (v instanceof Array) {
                var a = [], i;
                for (i = 0; i < v.length; i++) a.push(s(v[i]));
                return "[" + a.join(",") + "]";
            }
            var p = [], k;
            for (k in v) {
                if (v.hasOwnProperty(k)) p.push(q(k) + ":" + s(v[k]));
            }
            return "{" + p.join(",") + "}";
        }
        return s(value);
    }

    function normalizeInddName(name) {
        var n = safeStr(name || "Neues_Dokument.indd");
        if (!/\.indd$/i.test(n)) n += ".indd";
        return n;
    }

    function safeBase(name) {
        var s = safeStr(name).replace(/\.[^\.]+$/, "");
        s = s.replace(/[\\\/:*?\"<>|]/g, "_");
        return s || "InDesign_Document";
    }

    function defaultFolder(doc) {
        try { if (doc && doc.saved) return doc.filePath.fsName; } catch (_) {}
        return Folder.desktop.fsName;
    }

    function stampNow() {
        var d = new Date();
        return d.getFullYear() + two(d.getMonth()+1) + two(d.getDate()) + "_" + two(d.getHours()) + two(d.getMinutes()) + two(d.getSeconds());
    }

    function isoNow() {
        var d = new Date();
        return d.getFullYear() + "-" + two(d.getMonth()+1) + "-" + two(d.getDate()) + "T" + two(d.getHours()) + ":" + two(d.getMinutes()) + ":" + two(d.getSeconds());
    }

    function two(n) { return n < 10 ? "0" + n : String(n); }

    function errText(e) {
        if (!e) return "Unbekannter Fehler";
        var s = safeStr(e.message || e);
        try { if (e.line) s += " (Zeile " + e.line + ")"; } catch (_) {}
        try { if (e.number) s += " [" + e.number + "]"; } catch (_) {}
        return s;
    }

})();

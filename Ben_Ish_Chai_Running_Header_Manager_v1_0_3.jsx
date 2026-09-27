#target "InDesign"
#targetengine "BenIshChaiRunningHeaderManager_v103"

/*
    Ben Ish Chai · Running Header Manager v1.0.3
    Target: Adobe InDesign 18.1 / ExtendScript (ES3)

    Purpose
    -------
    Adds bilingual running headers retrospectively to finished Ben Ish Chai
    bilingual volumes without touching the Hebrew/English body-text geometry.

    Production convention
    ---------------------
      LEFT-HAND pages  : English running head + outer page number
      RIGHT-HAND pages : Hebrew running head + outer page number
      First page of each newly detected Parashah: running head remains visible
      and the Parashah name is emphasized in bold for orientation
      Front matter / excluded pages: no running head

    Primary title source
    --------------------
      1. The BILINGUAL.txt stored in the document label BIH_BILINGUAL_SOURCE
      2. InDesign paragraph styles BIH · Abschnitt · Hebräisch / English
      3. Built-in Parashah catalogue
      4. Manual page-range overrides

    v1.0.3
    ------
      - based on the clean v1.0.2 branch (which itself is directly based on v1.0.0)
      - Parashah start pages now KEEP their running header by default
      - on a Parashah start page only the Parashah portion is emphasized in bold
        (English: Parashah name; Hebrew: "פרשת + name" when present)
      - the former "hide first Parashah page" option remains available only as an optional legacy exception
      - no changes to page numbering, page-number labels, HE/EN body-frame geometry or Parashah detection
      - the v1.0.2 report listing of pages without a running header remains intact

    Safety
    ------
      - INDD backup before destructive actions (optional, default ON)
      - one-step Undo for each button action where InDesign supports ENTIRE_SCRIPT
      - body text frames BIH_HE_FRAME / BIH_EN_FRAME are never moved or resized
      - only page-number frames, dedicated header frames and optional top rules
        are created/updated/removed
*/

(function () {
    var APP_NAME = "Ben Ish Chai · Kolumnentitel-Manager";
    var VERSION = "1.0.3";

    // ---- Existing labels/styles from the bilingual book manager ----
    var FRAME_HE_LABEL = "BIH_HE_FRAME";
    var FRAME_EN_LABEL = "BIH_EN_FRAME";
    var PAGE_NUMBER_LABEL = "BIH_PAGE_NUMBER";
    var DOC_SOURCE_LABEL = "BIH_BILINGUAL_SOURCE";
    var DOC_VOLUME_LABEL = "BIH_VOLUME_NUMBER";
    var STYLE_HE_HEAD = "BIH · Abschnitt · Hebräisch";
    var STYLE_EN_HEAD = "BIH · Section · English";

    // ---- New labels ----
    var HEADER_FRAME_LABEL = "BIH_RUNNING_HEADER";
    var HEADER_RULE_LABEL = "BIH_RUNNING_HEADER_RULE";
    var HEADER_LAYER_NAME = "BIH · Kolumnentitel";
    var DOC_LAST_BACKUP_LABEL = "BIH_RUNNING_HEADER_LAST_BACKUP";
    var DOC_LAST_REPORT_LABEL = "BIH_RUNNING_HEADER_LAST_REPORT";
    var RULE_ORIGIN_KEY = "BIH_HEADER_RULE_ORIGIN";
    var RULE_OLD_WEIGHT_KEY = "BIH_HEADER_RULE_OLD_WEIGHT";

    // ---- Page geometry calibrated to the existing A5 production layout ----
    var PAGE_W_MM = 148;
    var DEFAULT_TOP_MM = 5.20;
    var DEFAULT_BOTTOM_MM = 11.50;
    var PAGE_NUM_LEFT_MM = 15.90;
    var PAGE_NUM_RIGHT_MM = 28.00;
    var HEADER_LEFT_MM = 31.50;
    var TEXT_RIGHT_MM = 128.57;
    var DEFAULT_RULE_Y_MM = 16.10;

    // ---- UI colours, same logic as the main book manager ----
    var UI_BLUE = [0.18, 0.43, 0.73, 1];
    var UI_GREEN = [0.16, 0.56, 0.31, 1];
    var UI_MAGENTA = [0.82, 0.20, 0.52, 1];
    var UI_ORANGE = [0.86, 0.49, 0.10, 1];
    var UI_TEXT_LIGHT = [1, 1, 1, 1];
    var UI_DISABLED = [0.36, 0.36, 0.36, 1];

    var state = {
        sourceFile: null,
        overrides: [],
        lastAnalysis: null
    };

    var PARASHOT = buildParashahCatalogue();

    showPalette();

    // =====================================================================
    // UI
    // =====================================================================

    function showPalette() {
        try {
            var old = $.global.__BIH_RUNNING_HEADER_MANAGER_V103__;
            if (old && old.visible) { old.active = true; return; }
        } catch (_) {}

        var w = new Window("palette", APP_NAME + " v" + VERSION, undefined, {resizeable:true});
        $.global.__BIH_RUNNING_HEADER_MANAGER_V103__ = w;
        w.orientation = "column";
        w.alignChildren = "fill";
        w.margins = 12;
        w.spacing = 8;
        w.minimumSize = [990, 650];
        w.preferredSize = [1160, 860];

        var tabs = w.add("tabbedpanel");
        tabs.alignChildren = ["fill", "fill"];
        tabs.alignment = ["fill", "fill"];

        // -----------------------------------------------------------------
        // Tab 1: Source / analysis
        // -----------------------------------------------------------------
        var sourceTab = tabs.add("tab", undefined, "1 · Quelle & Analyse");
        sourceTab.orientation = "column";
        sourceTab.alignChildren = "fill";
        sourceTab.margins = 12;
        sourceTab.spacing = 9;

        addWorkflowLegend(sourceTab, [
            {label:"BLAU · Analyse / Quelle", color:UI_BLUE, tip:"Nicht-destruktive Erkennung der Parashah-Bereiche und der gespeicherten Bandquelle."},
            {label:"MAGENTA · Fallback", color:UI_MAGENTA, tip:"Ersatzwege, wenn Quelle oder Absatzformat nicht eindeutig verfügbar sind."}
        ]);

        var docPanel = sourceTab.add("panel", undefined, "Aktiver InDesign-Band");
        docPanel.orientation = "column";
        docPanel.alignChildren = "fill";
        docPanel.margins = 10;
        var docRow = docPanel.add("group");
        docRow.add("statictext", undefined, "Dokument:");
        var docInfo = docRow.add("edittext", undefined, "Kein Dokument erkannt", {readonly:true});
        docInfo.characters = 72;
        var refreshDocBtn = docRow.add("button", undefined, "Aktualisieren");

        var srcPanel = sourceTab.add("panel", undefined, "BILINGUAL-TXT · bevorzugte Titelquelle");
        srcPanel.orientation = "column";
        srcPanel.alignChildren = "fill";
        srcPanel.margins = 10;
        var srcRow = srcPanel.add("group");
        srcRow.add("statictext", undefined, "Banddatei:");
        var sourceEdit = srcRow.add("edittext", undefined, "");
        sourceEdit.characters = 68;
        var sourceFromDocBtn = srcRow.add("button", undefined, "Aus Dokumentlabel");
        var sourceChooseBtn = srcRow.add("button", undefined, "Auswählen …");
        var srcHelp = srcPanel.add("statictext", undefined,
            "Wenn die gespeicherte Datei nicht mehr am ursprünglichen Ort liegt, kann sie hier neu gewählt werden. Ohne TXT greift automatisch der Parashah-Fallback.",
            {multiline:true});
        srcHelp.preferredSize.width = 930;

        var analyzePanel = sourceTab.add("panel", undefined, "Erkennung");
        analyzePanel.orientation = "row";
        analyzePanel.alignChildren = ["left", "center"];
        analyzePanel.margins = 10;
        var analyzeBtn = analyzePanel.add("button", undefined, "Band analysieren");
        var yearMode = analyzePanel.add("dropdownlist", undefined, [
            "Jahr: Auto (nur wenn sicher)",
            "Jahr: FIRST YEAR / שנה ראשונה",
            "Jahr: SECOND YEAR / שנה שנייה",
            "Jahr im Header nicht verwenden"
        ]);
        yearMode.selection = 0;
        var bodyOnlyCheck = analyzePanel.add("checkbox", undefined, "Nur BIH-Textseiten");
        bodyOnlyCheck.value = true;
        bodyOnlyCheck.helpTip = "Header werden nur auf Seiten gesetzt, die BIH_HE_FRAME oder BIH_EN_FRAME enthalten. Das schützt nachträglich eingefügte Titel-/Impressumsseiten.";

        var analysisStatus = sourceTab.add("edittext", undefined,
            "Noch nicht analysiert.", {multiline:true, readonly:true, scrolling:true});
        analysisStatus.preferredSize = [940, 390];

        // -----------------------------------------------------------------
        // Tab 2: Design
        // -----------------------------------------------------------------
        var designTab = tabs.add("tab", undefined, "2 · Gestaltung");
        designTab.orientation = "column";
        designTab.alignChildren = "fill";
        designTab.margins = 12;
        designTab.spacing = 9;

        addWorkflowLegend(designTab, [
            {label:"GRÜN · Kolumnentitel setzen", color:UI_GREEN, tip:"Produktive Gestaltung der neuen Kolumnentitel."},
            {label:"ORANGE · Seitenzahl / Linie", color:UI_ORANGE, tip:"Bestehende Seitenzahlen werden nur im Kopfbereich repariert bzw. formatiert; der Fließtext bleibt unangetastet."}
        ]);

        var templatePanel = designTab.add("panel", undefined, "Textvorlage");
        templatePanel.orientation = "column";
        templatePanel.alignChildren = "fill";
        templatePanel.margins = 10;
        var templateRow = templatePanel.add("group");
        templateRow.add("statictext", undefined, "Vorlage:");
        var templateMode = templateRow.add("dropdownlist", undefined, [
            "Kurz · empfohlen für A5",
            "Lang · mit Jahr",
            "Benutzerdefiniert"
        ]);
        templateMode.selection = 0;
        var autoShortCheck = templateRow.add("checkbox", undefined, "Bei Platzmangel automatisch Kurzfassung");
        autoShortCheck.value = true;

        var enTplRow = templatePanel.add("group");
        enTplRow.add("statictext", undefined, "Englisch:");
        var enTemplateEdit = enTplRow.add("edittext", undefined, "BEN ISH CHAI · {PARASHAH}");
        enTemplateEdit.characters = 82;
        var heTplRow = templatePanel.add("group");
        heTplRow.add("statictext", undefined, "Hebräisch:");
        var heTemplateEdit = heTplRow.add("edittext", undefined, "בן איש חי · פרשת {PARASHAH_HE}");
        heTemplateEdit.characters = 82;
        var tokenHelp = templatePanel.add("statictext", undefined,
            "Platzhalter: {PARASHAH} · {PARASHAH_HE} · {YEAR} · {YEAR_HE}.  Bei unbekanntem Jahr wird niemals geraten; bei Bedarf fällt der Lauf auf die Kurzvorlage zurück.",
            {multiline:true});
        tokenHelp.preferredSize.width = 930;

        var typePanel = designTab.add("panel", undefined, "Typografie");
        typePanel.orientation = "column";
        typePanel.alignChildren = "fill";
        typePanel.margins = 10;

        var enTypeRow = typePanel.add("group");
        enTypeRow.add("statictext", undefined, "EN Font:");
        var enFontEdit = enTypeRow.add("edittext", undefined, "Cambria"); enFontEdit.characters = 16;
        enTypeRow.add("statictext", undefined, "Schnitt:");
        var enStyleEdit = enTypeRow.add("edittext", undefined, "Regular"); enStyleEdit.characters = 10;
        enTypeRow.add("statictext", undefined, "Größe:");
        var enSizeEdit = enTypeRow.add("edittext", undefined, "7.5"); enSizeEdit.characters = 5;
        enTypeRow.add("statictext", undefined, "pt · Laufweite:");
        var enTrackingEdit = enTypeRow.add("edittext", undefined, "35"); enTrackingEdit.characters = 5;
        enTypeRow.add("statictext", undefined, "· Minimum:");
        var enMinSizeEdit = enTypeRow.add("edittext", undefined, "6.5"); enMinSizeEdit.characters = 5;

        var heTypeRow = typePanel.add("group");
        heTypeRow.add("statictext", undefined, "HE Font:");
        var heFontEdit = heTypeRow.add("edittext", undefined, "Keter YG"); heFontEdit.characters = 16;
        heTypeRow.add("statictext", undefined, "Schnitt:");
        var heStyleEdit = heTypeRow.add("edittext", undefined, "Medium"); heStyleEdit.characters = 10;
        heTypeRow.add("statictext", undefined, "Größe:");
        var heSizeEdit = heTypeRow.add("edittext", undefined, "8"); heSizeEdit.characters = 5;
        heTypeRow.add("statictext", undefined, "pt · Laufweite:");
        var heTrackingEdit = heTypeRow.add("edittext", undefined, "0"); heTrackingEdit.characters = 5;
        heTypeRow.add("statictext", undefined, "· Minimum:");
        var heMinSizeEdit = heTypeRow.add("edittext", undefined, "7"); heMinSizeEdit.characters = 5;

        var startTypeRow = typePanel.add("group");
        var emphasizeStartCheck = startTypeRow.add("checkbox", undefined, "Parashah-Name auf der ersten Parashah-Seite fett hervorheben");
        emphasizeStartCheck.value = true;
        emphasizeStartCheck.helpTip = "Der Kolumnentitel bleibt auf der Startseite sichtbar. Nur der Parashah-Teil wird stärker gesetzt; die restliche Kopfzeile bleibt unverändert.";
        startTypeRow.add("statictext", undefined, "EN-Schnitt:");
        var startEnStyleEdit = startTypeRow.add("edittext", undefined, "Bold"); startEnStyleEdit.characters = 10;
        startTypeRow.add("statictext", undefined, "HE-Schnitt:");
        var startHeStyleEdit = startTypeRow.add("edittext", undefined, "Bold"); startHeStyleEdit.characters = 10;
        startTypeRow.add("statictext", undefined, "(Fallback: Grundschnitt; wird im Ergebnis gemeldet)");

        var numTypeRow = typePanel.add("group");
        numTypeRow.add("statictext", undefined, "Seitenzahl:");
        var numFontEdit = numTypeRow.add("edittext", undefined, "Cambria"); numFontEdit.characters = 16;
        var numStyleEdit = numTypeRow.add("edittext", undefined, "Bold"); numStyleEdit.characters = 10;
        var numSizeEdit = numTypeRow.add("edittext", undefined, "8.5"); numSizeEdit.characters = 5;
        numTypeRow.add("statictext", undefined, "pt · Trennzeichen:");
        var separatorEdit = numTypeRow.add("edittext", undefined, "·"); separatorEdit.characters = 3;
        numTypeRow.add("statictext", undefined, "Header-Tonwert:");
        var tintEdit = numTypeRow.add("edittext", undefined, "85"); tintEdit.characters = 4;
        numTypeRow.add("statictext", undefined, "% Schwarz");

        var geoPanel = designTab.add("panel", undefined, "Position · A5");
        geoPanel.orientation = "row";
        geoPanel.alignChildren = ["left", "center"];
        geoPanel.margins = 10;
        geoPanel.add("statictext", undefined, "Rahmen oben:");
        var topEdit = geoPanel.add("edittext", undefined, String(DEFAULT_TOP_MM)); topEdit.characters = 6;
        geoPanel.add("statictext", undefined, "mm · unten:");
        var bottomEdit = geoPanel.add("edittext", undefined, String(DEFAULT_BOTTOM_MM)); bottomEdit.characters = 6;
        geoPanel.add("statictext", undefined, "mm · Abstand Zahl/Header: 3,5 mm · Headerbreite ≈ 97 mm");

        var rulePanel = designTab.add("panel", undefined, "Optionale feine Linie");
        rulePanel.orientation = "row";
        rulePanel.alignChildren = ["left", "center"];
        rulePanel.margins = 10;
        var ruleCheck = rulePanel.add("checkbox", undefined, "Vorhandene obere BIH-Linie als Headerlinie verwenden");
        ruleCheck.value = false;
        rulePanel.add("statictext", undefined, "Stärke:");
        var ruleWeightEdit = rulePanel.add("edittext", undefined, "0.25"); ruleWeightEdit.characters = 5;
        rulePanel.add("statictext", undefined, "pt · Y:");
        var ruleYEdit = rulePanel.add("edittext", undefined, String(DEFAULT_RULE_Y_MM)); ruleYEdit.characters = 6;
        rulePanel.add("statictext", undefined, "mm");

        // -----------------------------------------------------------------
        // Tab 3: fallback / exceptions
        // -----------------------------------------------------------------
        var fallbackTab = tabs.add("tab", undefined, "3 · Fallback & Ausnahmen");
        fallbackTab.orientation = "column";
        fallbackTab.alignChildren = "fill";
        fallbackTab.margins = 12;
        fallbackTab.spacing = 9;

        addWorkflowLegend(fallbackTab, [
            {label:"MAGENTA · Manuelle Fallbacks", color:UI_MAGENTA, tip:"Manuelle Parashah-Zuweisung für Seitenbereiche, wenn automatische Erkennung nicht genügt."},
            {label:"ORANGE · Ausnahmen", color:UI_ORANGE, tip:"Seiten, auf denen bewusst kein Kolumnentitel erscheinen soll."}
        ]);

        var hidePanel = fallbackTab.add("panel", undefined, "Automatische Ausblendung");
        hidePanel.orientation = "column";
        hidePanel.alignChildren = "left";
        hidePanel.margins = 10;
        var hideFirstCheck = hidePanel.add("checkbox", undefined, "Legacy-Ausnahme: auf der ersten Seite einer neuen Parashah den Kolumnentitel ausblenden");
        hideFirstCheck.value = false;
        hideFirstCheck.helpTip = "Standard ab v1.0.3: Parashah-Startseiten behalten den Kolumnentitel. Diese Option nur aktivieren, wenn die frühere Ausblendregel ausdrücklich gewünscht ist.";
        var excludedRow = hidePanel.add("group");
        excludedRow.add("statictext", undefined, "Zusätzlich ohne Kolumnentitel · physische Dokumentseiten:");
        var excludedEdit = excludedRow.add("edittext", undefined, "");
        excludedEdit.characters = 38;
        excludedRow.add("statictext", undefined, "z. B. 1-8, 17, 22-24");

        var overridePanel = fallbackTab.add("panel", undefined, "Manueller Parashah-Bereich");
        overridePanel.orientation = "column";
        overridePanel.alignChildren = "fill";
        overridePanel.margins = 10;

        var ovRow1 = overridePanel.add("group");
        ovRow1.add("statictext", undefined, "Seiten:");
        var ovPagesEdit = ovRow1.add("edittext", undefined, ""); ovPagesEdit.characters = 15;
        ovRow1.add("statictext", undefined, "English:");
        var ovEnEdit = ovRow1.add("edittext", undefined, ""); ovEnEdit.characters = 24;
        ovRow1.add("statictext", undefined, "עברית:");
        var ovHeEdit = ovRow1.add("edittext", undefined, ""); ovHeEdit.characters = 24;

        var ovRow2 = overridePanel.add("group");
        ovRow2.add("statictext", undefined, "Jahr:");
        var ovYear = ovRow2.add("dropdownlist", undefined, ["Auto", "First Year", "Second Year", "kein Jahr"]);
        ovYear.selection = 0;
        var ovStartCheck = ovRow2.add("checkbox", undefined, "erste Bereichsseite = neuer Parashah-Start");
        ovStartCheck.value = true;
        var ovAddBtn = ovRow2.add("button", undefined, "Override hinzufügen");
        var ovRemoveBtn = ovRow2.add("button", undefined, "Markierten Override entfernen");
        var ovClearBtn = ovRow2.add("button", undefined, "Alle Overrides löschen");

        var overrideList = overridePanel.add("listbox", undefined, [], {
            multiselect:false,
            numberOfColumns:4,
            showHeaders:true,
            columnTitles:["Seiten", "English", "עברית", "Jahr"],
            columnWidths:[110, 220, 220, 110]
        });
        overrideList.preferredSize = [930, 240];

        var fallbackHelp = fallbackTab.add("statictext", undefined,
            "Ein Override überschreibt die automatische Erkennung nur im angegebenen Seitenbereich. Dadurch kann ein einzelner problematischer Abschnitt repariert werden, ohne den restlichen Band neu aufzubauen.",
            {multiline:true});
        fallbackHelp.preferredSize.width = 930;

        // -----------------------------------------------------------------
        // Tab 4: actions / validation
        // -----------------------------------------------------------------
        var actionTab = tabs.add("tab", undefined, "4 · Ausführen & Prüfen");
        actionTab.orientation = "column";
        actionTab.alignChildren = "fill";
        actionTab.margins = 12;
        actionTab.spacing = 9;

        addWorkflowLegend(actionTab, [
            {label:"GRÜN · Anwenden", color:UI_GREEN, tip:"Kolumnentitel erzeugen oder aktualisieren."},
            {label:"BLAU · Prüfen", color:UI_BLUE, tip:"Nicht-destruktive Kontrolle."},
            {label:"ORANGE · Sicherheit / Reparatur", color:UI_ORANGE, tip:"Backup, Entfernen und reine Seitenzahlreparatur."}
        ]);

        var safetyPanel = actionTab.add("panel", undefined, "Sicherheit");
        safetyPanel.orientation = "row";
        safetyPanel.margins = 10;
        var backupCheck = safetyPanel.add("checkbox", undefined, "Vor Änderungen INDD-Sicherung anlegen");
        backupCheck.value = true;
        var saveAfterCheck = safetyPanel.add("checkbox", undefined, "Dokument nach erfolgreichem Lauf speichern");
        saveAfterCheck.value = false;
        safetyPanel.add("statictext", undefined, "Jeder Lauf ist zusätzlich als ein Undo-Schritt angelegt, soweit InDesign dies unterstützt.");

        var applyPanel = actionTab.add("panel", undefined, "Produktiver Lauf");
        applyPanel.orientation = "row";
        applyPanel.margins = 10;
        var testSpreadBtn = applyPanel.add("button", undefined, "Aktuelle Doppelseite testen");
        var applyAllBtn = applyPanel.add("button", undefined, "Alle Kolumnentitel erstellen / aktualisieren");
        var validateBtn = applyPanel.add("button", undefined, "Kolumnentitel prüfen");

        var repairPanel = actionTab.add("panel", undefined, "Reparatur / Rückbau");
        repairPanel.orientation = "row";
        repairPanel.margins = 10;
        var numbersBtn = repairPanel.add("button", undefined, "Seitenzahlen außen reparieren");
        var removeBtn = repairPanel.add("button", undefined, "Nur Kolumnentitel entfernen");

        var actionStatus = actionTab.add("edittext", undefined,
            "Bereit.", {multiline:true, readonly:true, scrolling:true});
        actionStatus.preferredSize = [940, 390];

        // -----------------------------------------------------------------
        // Workflow colours and tips
        // -----------------------------------------------------------------
        styleWorkflowButton(refreshDocBtn, UI_BLUE, "Aktives Dokument und gespeicherte Bandquelle neu einlesen.");
        styleWorkflowButton(sourceFromDocBtn, UI_BLUE, "Den in BIH_BILINGUAL_SOURCE gespeicherten Pfad aus dem aktiven Band übernehmen.");
        styleWorkflowButton(sourceChooseBtn, UI_BLUE, "BILINGUAL.txt manuell wählen. Nützlich, wenn der Projektordner verschoben wurde.");
        styleWorkflowButton(analyzeBtn, UI_BLUE, "Parashah-Starts, Jahresangaben, Seitenbereiche und Fallbacks ermitteln. Es wird nichts verändert.");

        styleWorkflowButton(ovAddBtn, UI_MAGENTA, "Manuellen Seitenbereich als Parashah-Override hinzufügen.");
        styleWorkflowButton(ovRemoveBtn, UI_MAGENTA, "Nur den markierten manuellen Override entfernen.");
        styleWorkflowButton(ovClearBtn, UI_MAGENTA, "Alle manuellen Overrides aus dieser Sitzung löschen.");

        styleWorkflowButton(testSpreadBtn, UI_GREEN, "Nur die aktuell sichtbare Doppelseite mit den jetzigen Einstellungen setzen. Ideal zur optischen Kontrolle.");
        styleWorkflowButton(applyAllBtn, UI_GREEN, "Alle automatisch und manuell ermittelten Kolumnentitel im aktiven Band setzen bzw. aktualisieren.");
        styleWorkflowButton(validateBtn, UI_BLUE, "Erwartete und vorhandene Kolumnentitel sowie Seitenzahlen vergleichen. Es wird nichts verändert.");
        styleWorkflowButton(numbersBtn, UI_ORANGE, "Nur die äußeren Seitenzahlen auf den BIH-Textseiten reparieren/formatieren; keine Kolumnentitel erzeugen.");
        styleWorkflowButton(removeBtn, UI_ORANGE, "Alle vom Header-Manager erzeugten Kolumnentitel entfernen. Seitenzahlen bleiben bestehen.");

        // -----------------------------------------------------------------
        // UI event helpers
        // -----------------------------------------------------------------
        function activeDocOrThrow() {
            if (!app.documents.length) throw new Error("Kein InDesign-Dokument geöffnet.");
            return app.activeDocument;
        }

        function updateDocDisplay() {
            try {
                if (!app.documents.length) {
                    docInfo.text = "Kein Dokument geöffnet";
                    return;
                }
                var d = app.activeDocument;
                docInfo.text = d.name + " · " + d.pages.length + " Seiten · Band " + (d.extractLabel(DOC_VOLUME_LABEL) || "?");
                var p = d.extractLabel(DOC_SOURCE_LABEL);
                if (p && !sourceEdit.text) sourceEdit.text = p;
            } catch (e) {
                docInfo.text = "Dokument konnte nicht gelesen werden: " + errorText(e);
            }
        }

        function applyTemplatePreset() {
            var idx = templateMode.selection ? templateMode.selection.index : 0;
            if (idx === 0) {
                enTemplateEdit.text = "BEN ISH CHAI · {PARASHAH}";
                heTemplateEdit.text = "בן איש חי · פרשת {PARASHAH_HE}";
            } else if (idx === 1) {
                enTemplateEdit.text = "BEN ISH CHAI · {YEAR} · {PARASHAH}";
                heTemplateEdit.text = "בן איש חי · הלכות {YEAR_HE} · פרשת {PARASHAH_HE}";
            }
        }

        function refreshOverrideList() {
            overrideList.removeAll();
            var i, ov, item;
            for (i = 0; i < state.overrides.length; i++) {
                ov = state.overrides[i];
                item = overrideList.add("item", ov.rangeText);
                item.subItems[0].text = ov.enTitle;
                item.subItems[1].text = ov.heTitle;
                item.subItems[2].text = ov.year === 1 ? "First" : (ov.year === 2 ? "Second" : (ov.year === 0 ? "kein" : "Auto"));
            }
        }

        function collectConfig() {
            var cfg = {};
            cfg.yearMode = yearMode.selection ? yearMode.selection.index : 0;
            cfg.bodyOnly = bodyOnlyCheck.value;
            cfg.templateMode = templateMode.selection ? templateMode.selection.index : 0;
            cfg.enTemplate = String(enTemplateEdit.text || "");
            cfg.heTemplate = String(heTemplateEdit.text || "");
            cfg.shortEnTemplate = "BEN ISH CHAI · {PARASHAH}";
            cfg.shortHeTemplate = "בן איש חי · פרשת {PARASHAH_HE}";
            cfg.autoShort = autoShortCheck.value;
            cfg.enFont = String(enFontEdit.text || "Cambria");
            cfg.enStyle = String(enStyleEdit.text || "Regular");
            cfg.enSize = positiveNumber(enSizeEdit.text, 7.5);
            cfg.enTracking = numberValue(enTrackingEdit.text, 35);
            cfg.enMinSize = positiveNumber(enMinSizeEdit.text, 6.5);
            cfg.heFont = String(heFontEdit.text || "Keter YG");
            cfg.heStyle = String(heStyleEdit.text || "Medium");
            cfg.heSize = positiveNumber(heSizeEdit.text, 8);
            cfg.heTracking = numberValue(heTrackingEdit.text, 0);
            cfg.heMinSize = positiveNumber(heMinSizeEdit.text, 7);
            cfg.emphasizeStart = emphasizeStartCheck.value;
            cfg.startEnStyle = String(startEnStyleEdit.text || "Bold");
            cfg.startHeStyle = String(startHeStyleEdit.text || "Bold");
            cfg.numFont = String(numFontEdit.text || "Cambria");
            cfg.numStyle = String(numStyleEdit.text || "Bold");
            cfg.numSize = positiveNumber(numSizeEdit.text, 8.5);
            cfg.separator = String(separatorEdit.text || "·");
            cfg.tint = clamp(numberValue(tintEdit.text, 85), 1, 100);
            cfg.topMm = positiveNumber(topEdit.text, DEFAULT_TOP_MM);
            cfg.bottomMm = positiveNumber(bottomEdit.text, DEFAULT_BOTTOM_MM);
            if (cfg.bottomMm <= cfg.topMm) throw new Error("Der untere Header-Rand muss unterhalb des oberen liegen.");
            cfg.ruleEnabled = ruleCheck.value;
            cfg.ruleWeight = positiveNumber(ruleWeightEdit.text, 0.25);
            cfg.ruleY = positiveNumber(ruleYEdit.text, DEFAULT_RULE_Y_MM);
            cfg.hideFirst = hideFirstCheck.value;
            cfg.excludedText = String(excludedEdit.text || "");
            cfg.backup = backupCheck.value;
            cfg.saveAfter = saveAfterCheck.value;
            cfg.overrides = state.overrides.slice(0);
            cfg.sourceFile = sourceEdit.text ? new File(sourceEdit.text) : null;
            return cfg;
        }

        refreshDocBtn.onClick = function () {
            try {
                updateDocDisplay();
                var d = activeDocOrThrow();
                var p = d.extractLabel(DOC_SOURCE_LABEL);
                if (p) sourceEdit.text = p;
            } catch (e) { alert(errorText(e), APP_NAME); }
        };

        sourceFromDocBtn.onClick = function () {
            try {
                var d = activeDocOrThrow();
                var p = d.extractLabel(DOC_SOURCE_LABEL);
                if (!p) throw new Error("Im aktiven Dokument ist kein " + DOC_SOURCE_LABEL + " gespeichert.");
                sourceEdit.text = p;
            } catch (e) { alert(errorText(e), APP_NAME); }
        };

        sourceChooseBtn.onClick = function () {
            var f = File.openDialog("Ben-Ish-Chai BILINGUAL.txt wählen", "Text:*.txt");
            if (f) sourceEdit.text = f.fsName;
        };

        analyzeBtn.onClick = function () {
            try {
                var d = activeDocOrThrow();
                var cfg = collectConfig();
                var a = analyzeDocument(d, cfg);
                state.lastAnalysis = a;
                analysisStatus.text = formatAnalysisReport(d, a, cfg);
            } catch (e) {
                analysisStatus.text = "ANALYSEFEHLER\r\n\r\n" + errorText(e);
                alert("Analyse fehlgeschlagen:\n\n" + errorText(e), APP_NAME);
            }
        };

        templateMode.onChange = function () {
            if (templateMode.selection && templateMode.selection.index < 2) applyTemplatePreset();
        };

        enTemplateEdit.onChanging = function () {
            if (templateMode.selection && templateMode.selection.index !== 2) templateMode.selection = 2;
        };
        heTemplateEdit.onChanging = function () {
            if (templateMode.selection && templateMode.selection.index !== 2) templateMode.selection = 2;
        };

        ovAddBtn.onClick = function () {
            try {
                var d = activeDocOrThrow();
                var rangeText = trim(ovPagesEdit.text);
                if (!rangeText) throw new Error("Bitte einen Seitenbereich angeben.");
                var flags = parsePhysicalPageRange(rangeText, d.pages.length);
                if (!countTrue(flags)) throw new Error("Der Seitenbereich enthält keine gültige physische Dokumentseite.");
                var enT = trim(ovEnEdit.text), heT = trim(ovHeEdit.text);
                if (!enT || !heT) throw new Error("Für einen manuellen Override werden englischer und hebräischer Parashah-Name benötigt.");
                var yi = ovYear.selection ? ovYear.selection.index : 0;
                var y = yi === 1 ? 1 : (yi === 2 ? 2 : (yi === 3 ? 0 : null));
                state.overrides.push({
                    rangeText:rangeText,
                    flags:flags,
                    enTitle:enT,
                    heTitle:heT,
                    year:y,
                    newStart:ovStartCheck.value
                });
                refreshOverrideList();
                ovPagesEdit.text = ""; ovEnEdit.text = ""; ovHeEdit.text = "";
            } catch (e) { alert("Override konnte nicht hinzugefügt werden:\n\n" + errorText(e), APP_NAME); }
        };

        ovRemoveBtn.onClick = function () {
            if (!overrideList.selection) return;
            var idx = overrideList.selection.index;
            if (idx === undefined || idx === null || idx < 0) return;
            state.overrides.splice(idx, 1);
            refreshOverrideList();
        };

        ovClearBtn.onClick = function () {
            state.overrides = [];
            refreshOverrideList();
        };

        testSpreadBtn.onClick = function () {
            try {
                var d = activeDocOrThrow(), cfg = collectConfig(), pages = activeSpreadPageIndexes(d);
                var result = runUndoable("BIH Kolumnentitel · Test-Doppelseite", function () {
                    return applyRunningHeaders(d, cfg, pages, "test");
                });
                actionStatus.text = result;
                updateDocDisplay();
            } catch (e) { alert("Testlauf fehlgeschlagen:\n\n" + errorText(e), APP_NAME); }
        };

        applyAllBtn.onClick = function () {
            try {
                var d = activeDocOrThrow(), cfg = collectConfig();
                var result = runUndoable("BIH Kolumnentitel · Alle Seiten", function () {
                    return applyRunningHeaders(d, cfg, null, "all");
                });
                actionStatus.text = result;
                updateDocDisplay();
            } catch (e) { alert("Kolumnentitel konnten nicht erstellt werden:\n\n" + errorText(e), APP_NAME); }
        };

        validateBtn.onClick = function () {
            try {
                var d = activeDocOrThrow(), cfg = collectConfig();
                actionStatus.text = validateRunningHeaders(d, cfg);
            } catch (e) { alert("Prüfung fehlgeschlagen:\n\n" + errorText(e), APP_NAME); }
        };

        numbersBtn.onClick = function () {
            try {
                var d = activeDocOrThrow(), cfg = collectConfig();
                var result = runUndoable("BIH Seitenzahlen reparieren", function () {
                    return repairPageNumbersOnly(d, cfg);
                });
                actionStatus.text = result;
            } catch (e) { alert("Seitenzahlen konnten nicht repariert werden:\n\n" + errorText(e), APP_NAME); }
        };

        removeBtn.onClick = function () {
            try {
                var d = activeDocOrThrow(), cfg = collectConfig();
                var result = runUndoable("BIH Kolumnentitel entfernen", function () {
                    return removeRunningHeaders(d, cfg);
                });
                actionStatus.text = result;
            } catch (e) { alert("Kolumnentitel konnten nicht entfernt werden:\n\n" + errorText(e), APP_NAME); }
        };

        w.onClose = function () {
            try { $.global.__BIH_RUNNING_HEADER_MANAGER_V103__ = null; } catch (_) {}
        };

        updateDocDisplay();
        try {
            if (app.documents.length) {
                var initialPath = app.activeDocument.extractLabel(DOC_SOURCE_LABEL);
                if (initialPath) sourceEdit.text = initialPath;
            }
        } catch (_) {}

        w.center();
        w.show();
    }

    // =====================================================================
    // Analysis
    // =====================================================================

    function analyzeDocument(doc, cfg) {
        var sourceEntries = [];
        var sourceUsed = false;
        var sourceWarning = "";
        if (cfg.sourceFile && cfg.sourceFile.exists) {
            try {
                sourceEntries = parseSourceParashot(cfg.sourceFile);
                sourceUsed = sourceEntries.length > 0;
                state.sourceFile = cfg.sourceFile;
            } catch (e) {
                sourceWarning = "BILINGUAL-TXT konnte nicht ausgewertet werden: " + errorText(e);
            }
        } else if (cfg.sourceFile && cfg.sourceFile.fsName) {
            sourceWarning = "Gespeicherte BILINGUAL-TXT nicht gefunden: " + cfg.sourceFile.fsName;
        }

        var heHeadings = collectHeadingParagraphs(doc, STYLE_HE_HEAD, FRAME_HE_LABEL, true, true);
        var enHeadings = collectHeadingParagraphs(doc, STYLE_EN_HEAD, FRAME_EN_LABEL, false, true);

        var starts = buildParashahStartsFromHebrew(heHeadings, sourceEntries);
        var usedEnglishFallback = false;
        if (!starts.length) {
            starts = buildParashahStartsFromEnglish(enHeadings, sourceEntries);
            usedEnglishFallback = starts.length > 0;
        }

        starts.sort(function (a,b) {
            if (a.pageIndex !== b.pageIndex) return a.pageIndex - b.pageIndex;
            return a.textIndex - b.textIndex;
        });
        starts = collapseSamePageStarts(starts);

        applyGlobalYearFallback(starts, cfg.yearMode);

        var pageMap = buildPageMap(doc, starts, cfg);
        applyManualOverrides(pageMap, doc, cfg);
        applyExcludedPages(pageMap, doc, cfg);

        var unresolvedYears = 0, i;
        for (i = 0; i < starts.length; i++) if (starts[i].year === null || starts[i].year === undefined) unresolvedYears++;

        return {
            sourceEntries:sourceEntries,
            sourceUsed:sourceUsed,
            sourceWarning:sourceWarning,
            heHeadings:heHeadings,
            enHeadings:enHeadings,
            starts:starts,
            pageMap:pageMap,
            usedEnglishFallback:usedEnglishFallback,
            unresolvedYears:unresolvedYears
        };
    }

    function collectHeadingParagraphs(doc, styleName, frameLabel, isHebrew, allowHeuristic) {
        var stories = collectStoriesByFrameLabel(doc, frameLabel);
        var out = [], i, j, story, paras, p, txt, styleOk, pageInfo, y;
        var foundStyled = 0;

        for (i = 0; i < stories.length; i++) {
            story = stories[i];
            paras = story.paragraphs;
            for (j = 0; j < paras.length; j++) {
                p = paras[j];
                txt = cleanHeadingText(p.contents);
                if (!txt) continue;
                styleOk = false;
                try { styleOk = p.appliedParagraphStyle && p.appliedParagraphStyle.isValid && p.appliedParagraphStyle.name === styleName; } catch (_) {}
                if (!styleOk) continue;
                pageInfo = paragraphPageInfo(p);
                if (!pageInfo) continue;
                y = detectYearMarker(txt);
                out.push({text:txt, pageIndex:pageInfo.index, pageName:pageInfo.name, textIndex:safeTextIndex(p), yearMarker:y, source:"style"});
                foundStyled++;
            }
        }

        if (foundStyled || !allowHeuristic) return dedupeHeadings(out);

        // Heuristic fallback: only short paragraphs containing a known Parashah
        // or an explicit year marker are accepted. This is deliberately narrow.
        for (i = 0; i < stories.length; i++) {
            story = stories[i]; paras = story.paragraphs;
            for (j = 0; j < paras.length; j++) {
                p = paras[j]; txt = cleanHeadingText(p.contents);
                if (!txt || txt.length > 120) continue;
                var par = isHebrew ? findParashahByHebrewTitle(txt) : findParashahByEnglishTitle(txt);
                y = detectYearMarker(txt);
                if (!par && !y) continue;
                if (!looksLikeHeadingParagraph(p)) continue;
                pageInfo = paragraphPageInfo(p);
                if (!pageInfo) continue;
                out.push({text:txt, pageIndex:pageInfo.index, pageName:pageInfo.name, textIndex:safeTextIndex(p), yearMarker:y, source:"heuristic"});
            }
        }
        return dedupeHeadings(out);
    }

    function collectStoriesByFrameLabel(doc, label) {
        var out = [], seen = {}, i, j, page, tf, story, id;
        for (i = 0; i < doc.pages.length; i++) {
            page = doc.pages[i];
            for (j = 0; j < page.textFrames.length; j++) {
                tf = page.textFrames[j];
                if (tf.label !== label) continue;
                try { story = tf.parentStory; } catch (_) { story = null; }
                if (!story || !story.isValid) continue;
                try { id = String(story.id); } catch (__){ id = "story_" + i + "_" + j; }
                if (!seen[id]) { seen[id] = true; out.push(story); }
            }
        }
        return out;
    }

    function paragraphPageInfo(p) {
        try {
            var ip = p.insertionPoints[0];
            var frames = ip.parentTextFrames;
            if (!frames || !frames.length) return null;
            var page = frames[0].parentPage;
            if (!page || !page.isValid) return null;
            return {index:page.documentOffset, name:page.name};
        } catch (_) { return null; }
    }

    function safeTextIndex(p) {
        try { return p.insertionPoints[0].index; } catch (_) { return 0; }
    }

    function looksLikeHeadingParagraph(p) {
        try {
            var ps = Number(p.pointSize);
            if (!isNaN(ps) && ps >= 12) return true;
        } catch (_) {}
        try {
            if (p.justification === Justification.CENTER_ALIGN) return true;
        } catch (_) {}
        return false;
    }

    function dedupeHeadings(a) {
        a.sort(function(x,y){ if (x.pageIndex !== y.pageIndex) return x.pageIndex-y.pageIndex; return x.textIndex-y.textIndex; });
        var out=[], seen={}, i, k;
        for(i=0;i<a.length;i++){
            k=a[i].pageIndex+"|"+normalizeTitle(a[i].text);
            if(!seen[k]){seen[k]=true;out.push(a[i]);}
        }
        return out;
    }

    function parseSourceParashot(file) {
        var raw = readUTF8(file);
        var re = /<section>\s*<he_title>([\s\S]*?)<\/he_title>\s*<en_title>([\s\S]*?)<\/en_title>\s*<\/section>/ig;
        var m, out=[], currentYear=null, he, en, y, par, projectEn, index=0;
        while ((m = re.exec(raw)) !== null) {
            he = cleanHeadingText(restoreCdata(xmlUnescape(m[1])));
            en = cleanHeadingText(restoreCdata(xmlUnescape(m[2])));
            y = detectYearMarker(he + " " + en);
            if (y) currentYear = y;
            par = findParashahByHebrewTitle(he);
            if (!par && en) par = findParashahByEnglishTitle(en);
            if (!par) continue;
            projectEn = extractProjectEnglishTitle(en, par.en);
            out.push({
                index:index++,
                heRaw:he,
                enRaw:en,
                parashaHe:par.he,
                parashaEn:projectEn,
                year:currentYear,
                key:par.key
            });
        }
        return out;
    }

    function buildParashahStartsFromHebrew(headings, sourceEntries) {
        var starts=[], sourceCursor=0, currentYear=null, i, h, par, match;
        for (i = 0; i < headings.length; i++) {
            h = headings[i];
            if (h.yearMarker) currentYear = h.yearMarker;
            par = findParashahByHebrewTitle(h.text);
            if (!par) continue;
            match = findSequentialSourceMatch(sourceEntries, sourceCursor, par.key, h.text, true);
            if (match) {
                sourceCursor = match.index + 1;
                if (match.entry.year) currentYear = match.entry.year;
            }
            starts.push({
                pageIndex:h.pageIndex,
                pageName:h.pageName,
                textIndex:h.textIndex,
                parashaHe:match ? match.entry.parashaHe : par.he,
                parashaEn:match ? match.entry.parashaEn : par.en,
                year:match && match.entry.year ? match.entry.year : currentYear,
                detection:match ? "HE style + BILINGUAL" : (h.source === "heuristic" ? "HE heuristic + catalogue" : "HE style + catalogue")
            });
        }
        return starts;
    }

    function buildParashahStartsFromEnglish(headings, sourceEntries) {
        var starts=[], sourceCursor=0, currentYear=null, i, h, par, match;
        for (i = 0; i < headings.length; i++) {
            h = headings[i];
            if (h.yearMarker) currentYear = h.yearMarker;
            par = findParashahByEnglishTitle(h.text);
            if (!par) continue;
            match = findSequentialSourceMatch(sourceEntries, sourceCursor, par.key, h.text, false);
            if (match) {
                sourceCursor = match.index + 1;
                if (match.entry.year) currentYear = match.entry.year;
            }
            starts.push({
                pageIndex:h.pageIndex,
                pageName:h.pageName,
                textIndex:h.textIndex,
                parashaHe:match ? match.entry.parashaHe : par.he,
                parashaEn:match ? match.entry.parashaEn : par.en,
                year:match && match.entry.year ? match.entry.year : currentYear,
                detection:"EN fallback"
            });
        }
        return starts;
    }

    function findSequentialSourceMatch(entries, cursor, key, rawTitle, isHebrew) {
        if (!entries || !entries.length) return null;
        var i, e, normalizedRaw = normalizeTitle(rawTitle);
        for (i = cursor; i < entries.length; i++) {
            e = entries[i];
            if (e.key !== key) continue;
            if (isHebrew && normalizeTitle(e.heRaw) === normalizedRaw) return {index:i, entry:e};
            if (!isHebrew && normalizeTitle(e.enRaw) === normalizedRaw) return {index:i, entry:e};
        }
        for (i = cursor; i < entries.length; i++) {
            e = entries[i]; if (e.key === key) return {index:i, entry:e};
        }
        for (i = 0; i < cursor && i < entries.length; i++) {
            e = entries[i]; if (e.key === key) return {index:i, entry:e};
        }
        return null;
    }

    function collapseSamePageStarts(starts) {
        if (!starts.length) return starts;
        var out=[], i, last;
        for(i=0;i<starts.length;i++){
            last=out.length?out[out.length-1]:null;
            if(last && last.pageIndex===starts[i].pageIndex){
                // Keep the last heading on the page: if two short sections share
                // one page, the next page belongs to the later Parashah.
                out[out.length-1]=starts[i];
            }else out.push(starts[i]);
        }
        return out;
    }

    function applyGlobalYearFallback(starts, mode) {
        var forced = mode === 1 ? 1 : (mode === 2 ? 2 : null);
        var remove = mode === 3;
        var i;
        for (i = 0; i < starts.length; i++) {
            if (remove) starts[i].year = 0;
            else if (forced) starts[i].year = forced;
        }
    }

    function buildPageMap(doc, starts, cfg) {
        var map = [], i, s, next, p;
        for (i = 0; i < doc.pages.length; i++) map.push(null);
        for (i = 0; i < starts.length; i++) {
            s = starts[i];
            next = (i + 1 < starts.length) ? starts[i+1].pageIndex : doc.pages.length;
            for (p = s.pageIndex; p < next && p < doc.pages.length; p++) {
                map[p] = {
                    enTitle:s.parashaEn,
                    heTitle:s.parashaHe,
                    year:s.year,
                    startPage:(p === s.pageIndex),
                    source:s.detection,
                    visible:true
                };
            }
        }
        if (cfg.bodyOnly) {
            for (i = 0; i < doc.pages.length; i++) {
                if (map[i] && !isBihBodyPage(doc.pages[i])) map[i].visible = false;
            }
        }
        if (cfg.hideFirst) {
            for (i = 0; i < doc.pages.length; i++) if (map[i] && map[i].startPage) map[i].visible = false;
        }
        return map;
    }

    function applyManualOverrides(map, doc, cfg) {
        var i,j,ov,year,first=-1;
        for(i=0;i<cfg.overrides.length;i++){
            ov=cfg.overrides[i];first=-1;
            // Re-parse against current page count so an override survives page-count changes.
            var flags=parsePhysicalPageRange(ov.rangeText,doc.pages.length);
            for(j=0;j<doc.pages.length;j++){
                if(!flags[j])continue;
                if(first<0)first=j;
                year=ov.year;
                if(year===null || year===undefined){
                    year=(map[j] && map[j].year!==undefined)?map[j].year:null;
                    if((year===null || year===undefined) && cfg.yearMode===1)year=1;
                    if((year===null || year===undefined) && cfg.yearMode===2)year=2;
                    if(cfg.yearMode===3)year=0;
                }
                map[j]={
                    enTitle:ov.enTitle,
                    heTitle:ov.heTitle,
                    year:year,
                    startPage:false,
                    source:"manual override",
                    visible:true
                };
                if(cfg.bodyOnly && !isBihBodyPage(doc.pages[j]))map[j].visible=false;
            }
            if(first>=0 && ov.newStart){
                map[first].startPage=true;
                if(cfg.hideFirst)map[first].visible=false;
            }
        }
    }

    function applyExcludedPages(map, doc, cfg) {
        var flags=parsePhysicalPageRange(cfg.excludedText,doc.pages.length),i;
        for(i=0;i<doc.pages.length;i++)if(flags[i]){
            if(!map[i])map[i]={enTitle:"",heTitle:"",year:null,startPage:false,source:"excluded",visible:false};
            else map[i].visible=false;
        }
    }

    function isBihBodyPage(page) {
        var i, tf;
        try {
            for(i=0;i<page.textFrames.length;i++){
                tf=page.textFrames[i];
                if(tf.label===FRAME_HE_LABEL || tf.label===FRAME_EN_LABEL)return true;
            }
        } catch (_) {}
        return false;
    }

    // =====================================================================
    // Apply / format
    // =====================================================================

    function applyRunningHeaders(doc, cfg, pageIndexes, mode) {
        requireHeaderFonts(cfg);
        var a = analyzeDocument(doc, cfg);
        state.lastAnalysis = a;
        var backup = null;
        if (cfg.backup) backup = createInDesignBackup(doc, mode === "test" ? "header_test" : "headers");
        var layer = ensureHeaderLayer(doc);
        var selected = pageIndexLookup(pageIndexes, doc.pages.length);
        var allPages = pageIndexes === null || pageIndexes === undefined;
        var changed=0,hidden=0,created=0,updated=0,shortFallbacks=0,shrunk=0,rules=0,startEmphasis=0,emphasisFallbacks=0,noHeaderPages=[],i,page,info,headerResult;

        for(i=0;i<doc.pages.length;i++){
            if(!allPages && !selected[i])continue;
            page=doc.pages[i];info=a.pageMap[i];

            if(!info || !info.visible || !info.enTitle || !info.heTitle){
                if(removeHeaderFramesFromPage(page)>0)changed++;
                if(isBihBodyPage(page)) setPageNumberFrame(doc,page,cfg,false,layer);
                hidden++;
                noHeaderPages.push(displayPageNumber(page,i));
                if(cfg.ruleEnabled && isBihBodyPage(page)){normalizeHeaderRule(doc,page,cfg,layer);rules++;}
                continue;
            }

            setPageNumberFrame(doc,page,cfg,true,layer);
            headerResult=setHeaderForPage(doc,page,info,cfg,layer);
            if(headerResult.created)created++;else updated++;
            if(headerResult.usedShort)shortFallbacks++;
            if(headerResult.shrunk)shrunk++;
            if(headerResult.startEmphasis)startEmphasis++;
            if(headerResult.emphasisFallback)emphasisFallbacks++;
            if(cfg.ruleEnabled){normalizeHeaderRule(doc,page,cfg,layer);rules++;}
            changed++;
        }

        if(cfg.saveAfter)doc.save();
        var report = [];
        report.push(mode === "test" ? "TEST AUF AKTUELLER DOPPELSEITE ERFOLGREICH" : "KOLUMNENTITEL ERFOLGREICH AKTUALISIERT");
        report.push("Dokument: "+doc.name);
        report.push("Ausgewertete Parashah-Starts: "+a.starts.length);
        report.push("Header erstellt: "+created+" · aktualisiert: "+updated+" · ausgeblendet/ohne Header: "+hidden);
        report.push("Seiten ohne Kolumnentitel: "+formatPageLabelList(noHeaderPages));
        report.push("Kurzfassungs-Fallbacks: "+shortFallbacks+" · automatisch verkleinert: "+shrunk);
        if(cfg.emphasizeStart) report.push("Parashah-Startseiten mit fetter Parashah-Hervorhebung: "+startEmphasis+(emphasisFallbacks?" · Schrift-Fallbacks: "+emphasisFallbacks:""));
        if(cfg.ruleEnabled)report.push("Headerlinien geprüft/gesetzt: "+rules+" · "+cfg.ruleWeight+" pt");
        if(a.unresolvedYears && templateNeedsYear(cfg))report.push("WARNUNG: "+a.unresolvedYears+" Parashah-Starts ohne sichere Jahresangabe. Auf diesen Seiten wurde bei Bedarf die Kurzvorlage verwendet.");
        if(a.sourceWarning)report.push("WARNUNG Quelle: "+a.sourceWarning);
        if(backup)report.push("INDD-Sicherung: "+backup.fsName);
        report.push("Fließtext-Rahmen wurden nicht verändert.");
        var txt=report.join("\r\n");
        try{doc.insertLabel(DOC_LAST_REPORT_LABEL,txt);}catch(_){}
        return txt;
    }

    function setHeaderForPage(doc, page, info, cfg, layer) {
        var isLeft = isLeftPage(page);
        var existingHeaders = labeledFrames(page, HEADER_FRAME_LABEL);
        var created = existingHeaders.length === 0;
        var tf = getOrCreateSingleLabeledTextFrame(page, HEADER_FRAME_LABEL, layer);
        tf.geometricBounds = headerBounds(page, cfg.topMm, cfg.bottomMm);
        setFrameInsets(tf,0);
        try{tf.textFramePreferences.ignoreWrap=true;}catch(_){}
        try{tf.textFramePreferences.verticalJustification=VerticalJustification.CENTER_ALIGN;}catch(_){}
        try{tf.itemLayer=layer;}catch(_){}

        var lang = isLeft ? "en" : "he";
        var rendered = renderHeaderText(info, cfg, lang, false);
        var usedShort = rendered.usedShort;
        var fontSize = lang === "en" ? cfg.enSize : cfg.heSize;
        var minSize = lang === "en" ? cfg.enMinSize : cfg.heMinSize;
        var emph = formatHeaderTextFrame(doc, tf, rendered.text, cfg, lang, fontSize, info);

        if (headerNeedsFallback(tf) && cfg.autoShort && !usedShort) {
            rendered = renderHeaderText(info, cfg, lang, true);
            usedShort = true;
            emph = formatHeaderTextFrame(doc, tf, rendered.text, cfg, lang, fontSize, info);
        }

        var shrunk = false;
        while (headerNeedsFallback(tf) && fontSize - 0.24 >= minSize) {
            fontSize -= 0.25;
            shrunk = true;
            emph = formatHeaderTextFrame(doc, tf, rendered.text, cfg, lang, fontSize, info);
        }
        if (headerNeedsFallback(tf)) {
            throw new Error("Kolumnentitel passt auf physischer Seite "+(page.documentOffset+1)+" trotz Kurz-/Schrift-Fallback nicht in eine Zeile: "+rendered.text);
        }
        return {created:created,usedShort:usedShort,shrunk:shrunk,startEmphasis:!!(emph&&emph.applied),emphasisFallback:!!(emph&&emph.fallback)};
    }

    function renderHeaderText(info, cfg, lang, forceShort) {
        var year = info.year;
        var needsYear = !forceShort && (cfg.enTemplate.indexOf("{YEAR}")>=0 || cfg.heTemplate.indexOf("{YEAR_HE}")>=0);
        var useShort = forceShort;
        if (needsYear && (year===null || year===undefined)) useShort = true;
        if (cfg.yearMode===3 && needsYear) useShort = true;
        var tpl;
        if (useShort) tpl = lang === "en" ? cfg.shortEnTemplate : cfg.shortHeTemplate;
        else tpl = lang === "en" ? cfg.enTemplate : cfg.heTemplate;
        var text = tpl;
        text = replaceAllLiteral(text,"{PARASHAH}",info.enTitle||"");
        text = replaceAllLiteral(text,"{PARASHAH_HE}",info.heTitle||"");
        text = replaceAllLiteral(text,"{YEAR}",year===1?"FIRST YEAR":(year===2?"SECOND YEAR":""));
        text = replaceAllLiteral(text,"{YEAR_HE}",year===1?"שנה ראשונה":(year===2?"שנה שנייה":""));
        text = cleanTemplateSeparators(text);
        return {text:text,usedShort:useShort};
    }

    function formatHeaderTextFrame(doc, tf, text, cfg, lang, pointSize, info) {
        tf.contents = text;
        var t=tf.texts[0], font;
        if(lang==="en"){
            font=requireFont(cfg.enFont,cfg.enStyle);
            try{t.appliedFont=font;}catch(_){}
            try{t.fontStyle=cfg.enStyle;}catch(_){}
            t.pointSize=pointSize;
            try{t.leading=pointSize+1.1;}catch(_){}
            try{t.tracking=cfg.enTracking;}catch(_){}
            try{t.justification=Justification.LEFT_ALIGN;}catch(_){}
            try{t.paragraphDirection=ParagraphDirectionOptions.LEFT_TO_RIGHT_DIRECTION;}catch(_){}
        }else{
            font=requireFont(cfg.heFont,cfg.heStyle);
            try{t.appliedFont=font;}catch(_){}
            try{t.fontStyle=cfg.heStyle;}catch(_){}
            t.pointSize=pointSize;
            try{t.leading=pointSize+1.2;}catch(_){}
            try{t.tracking=cfg.heTracking;}catch(_){}
            try{t.justification=Justification.RIGHT_ALIGN;}catch(_){}
            try{t.paragraphDirection=ParagraphDirectionOptions.RIGHT_TO_LEFT_DIRECTION;}catch(_){}
            try{t.composer="Adobe World-Ready Paragraph Composer";}catch(_){}
        }
        try{t.hyphenation=false;}catch(_){}
        try{t.fillColor=blackSwatch(doc);t.fillTint=cfg.tint;}catch(_){}
        var emphasisResult = applyStartPageEmphasis(doc, tf, info, cfg, lang);
        try{tf.parentStory.recompose();}catch(_){}
        return emphasisResult;
    }

    function applyStartPageEmphasis(doc, tf, info, cfg, lang) {
        var result={applied:false,fallback:false};
        if(!cfg.emphasizeStart || !info || !info.startPage)return result;
        var full="",needle="",start=-1,end=-1,prefix="",preferredStyle="",family="",baseStyle="",font=null,range=null;
        try{full=String(tf.contents||"");}catch(_){return result;}
        if(lang==="en"){
            needle=String(info.enTitle||"");
            family=cfg.enFont; preferredStyle=cfg.startEnStyle; baseStyle=cfg.enStyle;
        }else{
            needle=String(info.heTitle||"");
            family=cfg.heFont; preferredStyle=cfg.startHeStyle; baseStyle=cfg.heStyle;
        }
        if(!needle)return result;
        if(lang==="he"){
            prefix="פרשת ";
            start=full.indexOf(prefix+needle);
            if(start>=0)end=start+prefix.length+needle.length-1;
        }
        if(start<0){
            start=full.indexOf(needle);
            if(start>=0)end=start+needle.length-1;
        }
        if(start<0 || end<start)return result;

        font=exactFontOrNull(family,preferredStyle);
        if(!font){
            font=strongerFontOrNull(family,baseStyle);
            if(!font){font=requireFont(family,baseStyle);result.fallback=true;}
            else if(String(preferredStyle||"").toLowerCase()!==fontStyleNameSafe(font).toLowerCase())result.fallback=true;
        }
        try{
            range=tf.texts[0].characters.itemByRange(start,end);
            range.appliedFont=font;
            try{range.fillTint=100;}catch(_){}
            result.applied=true;
        }catch(_){
            result.fallback=true;
        }
        return result;
    }

    function exactFontOrNull(family,style){
        var f=null;
        try{f=app.fonts.itemByName(family+"\t"+style);if(f&&f.isValid)return f;}catch(_){}
        return null;
    }

    function fontStyleNameSafe(font){
        try{return String(font.fontStyleName||font.styleName||"");}catch(_){return "";}
    }

    function strongerFontOrNull(family,baseStyle){
        var styles=["Bold","SemiBold","Semibold","Demi Bold","Demi","Medium"],i,f;
        for(i=0;i<styles.length;i++){
            if(String(styles[i]).toLowerCase()===String(baseStyle||"").toLowerCase())continue;
            f=exactFontOrNull(family,styles[i]);
            if(f)return f;
        }
        return null;
    }

    function headerNeedsFallback(tf) {
        try{if(tf.overflows)return true;}catch(_){}
        try{if(tf.parentStory.lines.length>1)return true;}catch(_){}
        return false;
    }

    function setPageNumberFrame(doc,page,cfg,withSeparator,layer){
        var tf=getOrCreateSingleLabeledTextFrame(page,PAGE_NUMBER_LABEL,null);
        tf.geometricBounds=pageNumberBounds(page,cfg.topMm,cfg.bottomMm);
        setFrameInsets(tf,0);
        try{tf.textFramePreferences.ignoreWrap=true;}catch(_){}
        try{tf.textFramePreferences.verticalJustification=VerticalJustification.CENTER_ALIGN;}catch(_){}
        tf.contents="";
        var isLeft=isLeftPage(page),sep=trim(cfg.separator);
        if(isLeft){
            try{tf.insertionPoints[0].contents=SpecialCharacters.AUTO_PAGE_NUMBER;}catch(_){tf.contents=page.name;}
            if(withSeparator&&sep)tf.insertionPoints[-1].contents=" "+sep;
        }else{
            if(withSeparator&&sep)tf.insertionPoints[0].contents=sep+" ";
            try{tf.insertionPoints[-1].contents=SpecialCharacters.AUTO_PAGE_NUMBER;}catch(_){tf.insertionPoints[-1].contents=page.name;}
        }
        var t=tf.texts[0], reg=requireFont(cfg.numFont,"Regular"), bold=requireFont(cfg.numFont,cfg.numStyle);
        try{t.appliedFont=bold;}catch(_){}
        try{t.fontStyle=cfg.numStyle;}catch(_){}
        t.pointSize=cfg.numSize;
        try{t.leading=cfg.numSize+0.8;}catch(_){}
        try{t.fillColor=blackSwatch(doc);t.fillTint=100;}catch(_){}
        try{t.justification=isLeft?Justification.LEFT_ALIGN:Justification.RIGHT_ALIGN;}catch(_){}
        try{t.paragraphDirection=ParagraphDirectionOptions.LEFT_TO_RIGHT_DIRECTION;}catch(_){}
        try{t.hyphenation=false;}catch(_){}
        if(withSeparator&&sep){
            try{
                var ci,ch;
                for(ci=0;ci<tf.characters.length;ci++){
                    ch=tf.characters[ci];
                    if(String(ch.contents)===sep){ch.appliedFont=reg;ch.fontStyle="Regular";ch.pointSize=Math.max(6.5,cfg.numSize-1);}
                }
            }catch(_){}
        }
        try{tf.parentStory.recompose();}catch(_){}
        return tf;
    }

    function normalizeHeaderRule(doc,page,cfg,layer){
        var line=findHeaderRule(page),origin,oldWeight;
        if(!line){
            line=page.graphicLines.add();
            line.label=HEADER_RULE_LABEL;
            try{line.insertLabel(RULE_ORIGIN_KEY,"created");}catch(_){}
            try{line.itemLayer=layer;}catch(_){}
            origin="created";
        }else{
            try{origin=line.extractLabel(RULE_ORIGIN_KEY);}catch(_){origin="";}
            if(!origin){
                try{oldWeight=String(line.strokeWeight);line.insertLabel(RULE_OLD_WEIGHT_KEY,oldWeight);line.insertLabel(RULE_ORIGIN_KEY,"existing");}catch(_){}
                try{line.label=HEADER_RULE_LABEL;}catch(_){}
            }
        }
        var b=ruleBounds(page,cfg.ruleY);
        try{line.paths[0].entirePath=[[b[1],b[0]],[b[3],b[2]]];}catch(_){}
        try{line.strokeWeight=cfg.ruleWeight;}catch(_){}
        try{line.strokeColor=blackSwatch(doc);}catch(_){}
        return line;
    }

    function findHeaderRule(page){
        var i,line,path,p1,p2,y1,y2,x1,x2;
        for(i=0;i<page.graphicLines.length;i++){
            line=page.graphicLines[i];
            if(line.label===HEADER_RULE_LABEL)return line;
        }
        // Fallback: locate the original BIH top rule near y=16.10 mm.
        for(i=0;i<page.graphicLines.length;i++){
            line=page.graphicLines[i];
            try{
                path=line.paths[0].entirePath;p1=path[0];p2=path[path.length-1];
                x1=Number(p1[0]);y1=Number(p1[1]);x2=Number(p2[0]);y2=Number(p2[1]);
                if(horizontalNearMm(y1,y2,DEFAULT_RULE_Y_MM,1.1) && spanAtLeastMm(x1,x2,80))return line;
            }catch(_){}
        }
        return null;
    }

    function removeRunningHeaders(doc,cfg){
        var backup=cfg.backup?createInDesignBackup(doc,"headers_remove"):null;
        var removed=0,restoredRules=0,i,page;
        for(i=0;i<doc.pages.length;i++){
            page=doc.pages[i];
            removed+=removeHeaderFramesFromPage(page);
            if(isBihBodyPage(page))setPageNumberFrame(doc,page,cfg,false,null);
            restoredRules+=restoreManagedRule(page);
        }
        if(cfg.saveAfter)doc.save();
        return "KOLUMNENTITEL ENTFERNT\r\nDokument: "+doc.name+"\r\nEntfernte Headerrahmen: "+removed+"\r\nWiederhergestellte/entfernte Headerlinien: "+restoredRules+(backup?"\r\nINDD-Sicherung: "+backup.fsName:"")+"\r\nSeitenzahlen bleiben bestehen.";
    }

    function restoreManagedRule(page){
        var i,line,origin,oldWeight,count=0;
        for(i=page.graphicLines.length-1;i>=0;i--){
            line=page.graphicLines[i];
            if(line.label!==HEADER_RULE_LABEL)continue;
            try{origin=line.extractLabel(RULE_ORIGIN_KEY);}catch(_){origin="";}
            if(origin==="created"){
                try{line.remove();count++;}catch(_){}
            }else{
                try{oldWeight=line.extractLabel(RULE_OLD_WEIGHT_KEY);if(oldWeight!=="")line.strokeWeight=Number(oldWeight);}catch(_){}
                try{line.label="";}catch(_){}
                try{line.insertLabel(RULE_ORIGIN_KEY,"");line.insertLabel(RULE_OLD_WEIGHT_KEY,"");}catch(_){}
                count++;
            }
        }
        return count;
    }

    function repairPageNumbersOnly(doc,cfg){
        requireFont(cfg.numFont,cfg.numStyle);
        var backup=cfg.backup?createInDesignBackup(doc,"page_numbers"):null;
        var count=0,i,page;
        for(i=0;i<doc.pages.length;i++){
            page=doc.pages[i];
            if(cfg.bodyOnly && !isBihBodyPage(page))continue;
            setPageNumberFrame(doc,page,cfg,false,null);count++;
        }
        if(cfg.saveAfter)doc.save();
        return "SEITENZAHLEN REPARIERT\r\nBearbeitete Seiten: "+count+"\r\nAußenposition: links auf linken Seiten, rechts auf rechten Seiten\r\nSchrift: "+cfg.numFont+" "+cfg.numStyle+" "+cfg.numSize+" pt"+(backup?"\r\nINDD-Sicherung: "+backup.fsName:"");
    }

    // =====================================================================
    // Validation / reports
    // =====================================================================

    function validateRunningHeaders(doc,cfg){
        var a=analyzeDocument(doc,cfg),missing=[],extra=[],wrongSide=[],dup=[],numMissing=[],noHeaderExpected=[],i,page,info,headers,nums;
        for(i=0;i<doc.pages.length;i++){
            page=doc.pages[i];info=a.pageMap[i];headers=labeledFrames(page,HEADER_FRAME_LABEL);nums=labeledFrames(page,PAGE_NUMBER_LABEL);
            var expected=!!(info&&info.visible&&info.enTitle&&info.heTitle);
            if(!expected)noHeaderExpected.push(displayPageNumber(page,i));
            if(expected&&!headers.length)missing.push(i+1);
            if(!expected&&headers.length)extra.push(i+1);
            if(headers.length>1)dup.push(i+1);
            if(cfg.bodyOnly&&isBihBodyPage(page)&&!nums.length)numMissing.push(i+1);
            if(headers.length){
                var txt=cleanHeadingText(headers[0].contents);
                if(isLeftPage(page)&&containsHebrew(txt))wrongSide.push((i+1)+"(HE auf links)");
                if(!isLeftPage(page)&&!containsHebrew(txt))wrongSide.push((i+1)+"(EN auf rechts)");
            }
        }
        var out=[];
        out.push("KOLUMNENTITEL-PRÜFUNG");
        out.push("Dokument: "+doc.name+" · "+doc.pages.length+" Seiten");
        out.push("Parashah-Starts erkannt: "+a.starts.length);
        out.push("Seiten ohne Kolumnentitel (laut aktueller Regel): "+formatPageLabelList(noHeaderExpected));
        out.push("Fehlende erwartete Header: "+formatNumberList(missing));
        out.push("Header auf laut Regel ausgeschlossenen Seiten: "+formatNumberList(extra));
        out.push("Doppelte Headerrahmen: "+formatNumberList(dup));
        out.push("Sprachseite auffällig: "+(wrongSide.length?wrongSide.join(", "):"keine"));
        out.push("Fehlende BIH-Seitenzahlen: "+formatNumberList(numMissing));
        if(a.unresolvedYears&&templateNeedsYear(cfg))out.push("Jahresangabe ungeklärt bei "+a.unresolvedYears+" Parashah-Start(s); Langvorlage würde dort auf Kurzfassung fallen.");
        if(a.sourceWarning)out.push("Quelle: "+a.sourceWarning);
        out.push((!missing.length&&!extra.length&&!dup.length&&!wrongSide.length)?"Ergebnis: keine strukturellen Headerfehler erkannt.":"Ergebnis: oben genannte Seiten prüfen/reparieren.");
        return out.join("\r\n");
    }

    function displayPageNumber(page,index){
        try{
            if(page && page.isValid && page.name!==undefined && String(page.name)!=="")return String(page.name);
        }catch(_){}
        return String(index+1);
    }

    function formatPageLabelList(a){
        if(!a || !a.length)return "keine";
        var out=[],i,chunk=[];
        for(i=0;i<a.length;i++){
            chunk.push(String(a[i]));
            if(chunk.length===18){out.push(chunk.join(", "));chunk=[];}
        }
        if(chunk.length)out.push(chunk.join(", "));
        return out.join("\r\n  ");
    }

    function formatAnalysisReport(doc,a,cfg){
        var out=[],i,s,next,endPage;
        out.push("BEN ISH CHAI · KOLUMNENTITEL-ANALYSE");
        out.push("Dokument: "+doc.name+" · "+doc.pages.length+" physische Seiten · Band "+(doc.extractLabel(DOC_VOLUME_LABEL)||"?"));
        out.push("HE-Überschriften erkannt: "+a.heHeadings.length+" · EN-Überschriften erkannt: "+a.enHeadings.length);
        out.push("Parashah-Starts: "+a.starts.length+" · Quelle: "+(a.sourceUsed?"BILINGUAL-TXT + InDesign":"InDesign/Katalog-Fallback"));
        if(a.usedEnglishFallback)out.push("Fallback aktiv: keine brauchbaren HE-Starts; EN-Überschriften wurden verwendet.");
        if(a.sourceWarning)out.push("WARNUNG: "+a.sourceWarning);
        if(a.unresolvedYears)out.push("Jahr nicht sicher erkannt bei: "+a.unresolvedYears+" Start(s). Auswahl 'First/Second Year' kann bandweise erzwingen; manuelle Overrides können einzelne Bereiche korrigieren.");
        out.push("");
        if(!a.starts.length){
            out.push("Keine Parashah erkannt. Prüfe die Absatzformate oder lege im Fallback-Reiter manuelle Bereiche an.");
            return out.join("\r\n");
        }
        out.push("Erkannte Bereiche:");
        for(i=0;i<a.starts.length;i++){
            s=a.starts[i];next=(i+1<a.starts.length)?a.starts[i+1].pageIndex:doc.pages.length;
            endPage=Math.max(s.pageIndex+1,next);
            out.push("  S. "+(s.pageIndex+1)+"–"+endPage+" · "+s.parashaEn+" / "+s.parashaHe+" · "+yearLabel(s.year)+" · "+s.detection+(cfg.hideFirst?" · Startseite ohne Header":(cfg.emphasizeStart?" · Startseite: Parashah fett":"")));
        }
        if(cfg.excludedText)out.push("Zusätzlich ausgeschlossen: "+cfg.excludedText);
        if(cfg.overrides.length)out.push("Manuelle Overrides in dieser Sitzung: "+cfg.overrides.length);
        out.push("");
        out.push("Noch keine Layoutänderung vorgenommen.");
        return out.join("\r\n");
    }

    // =====================================================================
    // Page-item helpers
    // =====================================================================

    function getOrCreateSingleLabeledTextFrame(page,label,layer){
        var arr=labeledFrames(page,label),tf,i;
        if(arr.length){
            tf=arr[0];
            for(i=arr.length-1;i>=1;i--)try{arr[i].remove();}catch(_){}
            return tf;
        }
        tf=page.textFrames.add();tf.label=label;
        if(layer)try{tf.itemLayer=layer;}catch(_){}
        return tf;
    }

    function labeledFrames(page,label){
        var a=[],i,tf;
        for(i=0;i<page.textFrames.length;i++){tf=page.textFrames[i];if(tf.label===label)a.push(tf);}
        return a;
    }

    function removeHeaderFramesFromPage(page){
        var a=labeledFrames(page,HEADER_FRAME_LABEL),i,n=0;
        for(i=a.length-1;i>=0;i--)try{a[i].remove();n++;}catch(_){}
        return n;
    }

    function headerBounds(page,top,bottom){
        // Canonical left-page coordinates: 31.5 .. 128.57 mm.
        // On right-hand pages they are mirrored to 19.43 .. 116.5 mm.
        if(isLeftPage(page))return [mm(top),mm(HEADER_LEFT_MM),mm(bottom),mm(TEXT_RIGHT_MM)];
        return [mm(top),mm(PAGE_W_MM-TEXT_RIGHT_MM),mm(bottom),mm(PAGE_W_MM-HEADER_LEFT_MM)];
    }

    function pageNumberBounds(page,top,bottom){
        if(isLeftPage(page))return [mm(top),mm(PAGE_NUM_LEFT_MM),mm(bottom),mm(PAGE_NUM_RIGHT_MM)];
        return [mm(top),mm(PAGE_W_MM-PAGE_NUM_RIGHT_MM),mm(bottom),mm(PAGE_W_MM-PAGE_NUM_LEFT_MM)];
    }

    function ruleBounds(page,y){
        if(isLeftPage(page))return [mm(y),mm(PAGE_NUM_LEFT_MM),mm(y),mm(TEXT_RIGHT_MM)];
        return [mm(y),mm(PAGE_W_MM-TEXT_RIGHT_MM),mm(y),mm(PAGE_W_MM-PAGE_NUM_LEFT_MM)];
    }

    function isLeftPage(page){
        try{return page.side===PageSideOptions.LEFT_HAND;}catch(_){}
        // Fallback for standard left-to-right facing-page documents.
        return ((page.documentOffset+1)%2===0);
    }

    function ensureHeaderLayer(doc){
        var l=doc.layers.itemByName(HEADER_LAYER_NAME);
        if(!l||!l.isValid)l=doc.layers.add({name:HEADER_LAYER_NAME});
        try{l.visible=true;l.locked=false;}catch(_){}
        return l;
    }

    function activeSpreadPageIndexes(doc){
        var a=[],i,p;
        try{
            var spread=app.activeWindow.activeSpread;
            for(i=0;i<spread.pages.length;i++){p=spread.pages[i];a.push(p.documentOffset);}
        }catch(_){}
        if(!a.length){
            try{a.push(app.activeWindow.activePage.documentOffset);}catch(__){a.push(0);}
        }
        return a;
    }

    function pageIndexLookup(indexes,count){
        var o={},i;
        if(indexes===null||indexes===undefined){for(i=0;i<count;i++)o[i]=true;return o;}
        for(i=0;i<indexes.length;i++)if(indexes[i]>=0&&indexes[i]<count)o[indexes[i]]=true;
        return o;
    }

    // =====================================================================
    // Parashah catalogue and matching
    // =====================================================================

    function buildParashahCatalogue(){
        var a=[
            ["bereshit","בראשית","Bereshit",["bereshit","bereishit"]],
            ["noach","נח","Noach",["noach","noah"]],
            ["lech_lecha","לך לך","Lech Lecha",["lech lecha","lekh lekha"]],
            ["vayera","וירא","Vayera",["vayera"]],
            ["chayei_sarah","חיי שרה","Chayei Sarah",["chayei sarah","hayei sarah"]],
            ["toldot","תולדות","Toldot",["toldot","toledot"]],
            ["vayetze","ויצא","Vayetze",["vayetze","vayeitzei"]],
            ["vayishlach","וישלח","Vayishlach",["vayishlach"]],
            ["vayeshev","וישב","Vayeshev",["vayeshev"]],
            ["miketz","מקץ","Miketz",["miketz","mikeitz"]],
            ["vayigash","ויגש","Vayigash",["vayigash"]],
            ["vayechi","ויחי","Vayechi",["vayechi"]],
            ["shemot","שמות","Shemot",["shemot"]],
            ["vaera","וארא","Va'era",["vaera","va era","va'era"]],
            ["bo","בא","Bo",["bo"]],
            ["beshalach","בשלח","Beshalach",["beshalach"]],
            ["yitro","יתרו","Yitro",["yitro","jethro"]],
            ["mishpatim","משפטים","Mishpatim",["mishpatim"]],
            ["terumah","תרומה","Terumah",["terumah"]],
            ["tetzaveh","תצוה","Tetzaveh",["tetzaveh","tetzave"]],
            ["ki_tisa","כי תשא","Ki Tisa",["ki tisa","ki tissa"]],
            ["vayakhel","ויקהל","Vayakhel",["vayakhel"]],
            ["pekudei","פקודי","Pekudei",["pekudei","pekudey"]],
            ["vayikra","ויקרא","Vayikra",["vayikra"]],
            ["tzav","צו","Tzav",["tzav","tsav"]],
            ["shemini","שמיני","Shemini",["shemini","shmini"]],
            ["tazria","תזריע","Tazria",["tazria"]],
            ["metzora","מצורע","Metzora",["metzora"]],
            ["acharei_mot","אחרי מות","Acharei Mot",["acharei mot","aharei mot"]],
            ["kedoshim","קדושים","Kedoshim",["kedoshim"]],
            ["emor","אמור","Emor",["emor"]],
            ["behar","בהר","Behar",["behar"]],
            ["bechukotai","בחקתי","Bechukotai",["bechukotai","bechukosai"], ["בחוקתי"]],
            ["bamidbar","במדבר","Bamidbar",["bamidbar"]],
            ["naso","נשא","Naso",["naso","nasso"]],
            ["behaalotcha","בהעלותך","Beha'alotcha",["behaalotcha","beha alotcha","beha'alotcha","behaalotekha"]],
            ["shelach","שלח","Shelach",["shelach","shlach"]],
            ["korach","קרח","Korach",["korach","korah"]],
            ["chukat","חקת","Chukat",["chukat","chukkat"]],
            ["balak","בלק","Balak",["balak"]],
            ["pinchas","פינחס","Pinchas",["pinchas","pinechas"], ["פנחס"]],
            ["matot","מטות","Matot",["matot","matos"]],
            ["masei","מסעי","Masei",["masei","mas'ei"]],
            ["devarim","דברים","Devarim",["devarim"]],
            ["vaetchanan","ואתחנן","Vaetchanan",["vaetchanan","va'etchanan"]],
            ["eikev","עקב","Eikev",["eikev","ekev"]],
            ["reeh","ראה","Re'eh",["reeh","re eh","re'eh"]],
            ["shoftim","שופטים","Shoftim",["shoftim"]],
            ["ki_tetze","כי תצא","Ki Tetze",["ki tetze","ki teitzei"]],
            ["ki_tavo","כי תבוא","Ki Tavo",["ki tavo"]],
            ["nitzavim","נצבים","Nitzavim",["nitzavim"]],
            ["vayelech","וילך","Vayelech",["vayelech"]],
            ["haazinu","האזינו","Ha'azinu",["haazinu","ha azinu","ha'azinu"]],
            ["vezot_haberakhah","וזאת הברכה","Vezot Haberakhah",["vezot haberakhah","vezot habracha","v'zot haberakhah"]]
        ];
        var out=[],i,j,aliases;
        for(i=0;i<a.length;i++){
            aliases=[a[i][1]];
            if(a[i].length>4&&a[i][4])for(j=0;j<a[i][4].length;j++)aliases.push(a[i][4][j]);
            out.push({key:a[i][0],he:a[i][1],en:a[i][2],enAliases:a[i][3],heAliases:aliases});
        }
        return out;
    }

    function findParashahByHebrewTitle(s){
        var t=" "+normalizeHebrewWords(s)+" ",i,j,p,a;
        if(!trim(t))return null;
        for(i=0;i<PARASHOT.length;i++){
            p=PARASHOT[i];
            // Longest aliases first would be ideal; list is already specific.
            for(j=0;j<p.heAliases.length;j++){
                a=" "+normalizeHebrewWords(p.heAliases[j])+" ";
                if(t.indexOf(a)>=0)return p;
            }
        }
        return null;
    }

    function findParashahByEnglishTitle(s){
        var t=" "+normalizeEnglishWords(s)+" ",i,j,p,a;
        if(!trim(t))return null;
        for(i=0;i<PARASHOT.length;i++){
            p=PARASHOT[i];
            a=" "+normalizeEnglishWords(p.en)+" ";if(t.indexOf(a)>=0)return p;
            for(j=0;j<p.enAliases.length;j++){
                a=" "+normalizeEnglishWords(p.enAliases[j])+" ";if(t.indexOf(a)>=0)return p;
            }
        }
        return null;
    }

    function extractProjectEnglishTitle(enRaw,fallback){
        var t=cleanHeadingText(enRaw);
        if(!t||containsHebrew(t))return fallback;
        var parts=t.split(/\s*[·|]\s*/g),i,c;
        for(i=parts.length-1;i>=0;i--){
            c=trim(parts[i]).replace(/^(parashah|parashat)\s+/i,"");
            if(!c)continue;
            if(/^(first|second)\s+year$/i.test(c))continue;
            if(findParashahByEnglishTitle(c))return c;
        }
        var p=findParashahByEnglishTitle(t);
        if(p)return cleanEnglishParashaFromRaw(t,p.en);
        return fallback;
    }

    function cleanEnglishParashaFromRaw(raw,fallback){
        var s=trim(String(raw||"")).replace(/^(parashah|parashat)\s+/i,"");
        s=s.replace(/\b(first|second)\s+year\b/ig,"").replace(/^[\s·|:-]+|[\s·|:-]+$/g,"");
        return s&&s.length<50?s:fallback;
    }

    function detectYearMarker(s){
        s=String(s||"");
        if(/שנה\s+ראשונ(?:ה|הּ)?/.test(stripHebrewMarks(s))||/\bfirst\s+year\b/i.test(s))return 1;
        if(/שנה\s+שנ(?:יה|ייה|י)/.test(stripHebrewMarks(s))||/\bsecond\s+year\b/i.test(s))return 2;
        return null;
    }

    function yearLabel(y){return y===1?"First Year / שנה ראשונה":(y===2?"Second Year / שנה שנייה":(y===0?"ohne Jahr":"Jahr ungeklärt"));}

    // =====================================================================
    // Safety / generic helpers
    // =====================================================================

    function createInDesignBackup(doc,suffix){
        var original;
        try{original=doc.fullName;}catch(_){original=null;}
        if(!original||!original.exists)throw new Error("Der aktive InDesign-Band muss vor der Änderung einmal gespeichert werden.");
        var base=original.displayName.replace(/\.indd$/i,"");
        var backup=uniqueFile(new File(original.parent.fsName+"/"+base+"_backup_"+suffix+"_"+timestamp()+".indd"));
        try{doc.saveACopy(backup);}catch(e){throw new Error("INDD-Sicherung konnte nicht angelegt werden: "+errorText(e));}
        if(!backup.exists)throw new Error("INDD-Sicherung wurde nicht gefunden. Änderung wurde nicht begonnen.");
        try{doc.insertLabel(DOC_LAST_BACKUP_LABEL,backup.fsName);}catch(_){}
        return backup;
    }

    function runUndoable(name,fn){
        var result;
        try{
            app.doScript(function(){result=fn();},ScriptLanguage.JAVASCRIPT,undefined,UndoModes.ENTIRE_SCRIPT,name);
            return result;
        }catch(e){
            // If the exception is from inside the operation, do not re-run it.
            throw e;
        }
    }

    function requireHeaderFonts(cfg){
        requireFont(cfg.enFont,cfg.enStyle);
        requireFont(cfg.heFont,cfg.heStyle);
        requireFont(cfg.numFont,cfg.numStyle);
        requireFont(cfg.numFont,"Regular");
    }

    function requireFont(family,style){
        var f=app.fonts.itemByName(family+"\t"+style);
        if(f&&f.isValid)return f;
        f=app.fonts.itemByName(family);
        if(f&&f.isValid)return f;
        throw new Error("Erforderliche Schrift fehlt: "+family+" "+style+".");
    }

    function blackSwatch(doc){
        var s=doc.swatches.itemByName("Black");if(s&&s.isValid)return s;
        s=doc.swatches.itemByName("$ID/Black");if(s&&s.isValid)return s;
        return doc.swatches[doc.swatches.length-1];
    }

    function setFrameInsets(tf,v){try{tf.textFramePreferences.insetSpacing=[v,v,v,v];}catch(_){} }

    function templateNeedsYear(cfg){return cfg.enTemplate.indexOf("{YEAR}")>=0||cfg.heTemplate.indexOf("{YEAR_HE}")>=0;}

    function parsePhysicalPageRange(text,count){
        var flags=[],i;for(i=0;i<count;i++)flags[i]=false;
        text=trim(text);if(!text)return flags;
        var parts=text.split(/[;,]+/),p,m,a,b,n,j;
        for(i=0;i<parts.length;i++){
            p=trim(parts[i]);if(!p)continue;
            m=/^(\d+)\s*-\s*(\d+)$/.exec(p);
            if(m){a=parseInt(m[1],10);b=parseInt(m[2],10);if(a>b){n=a;a=b;b=n;}for(j=a;j<=b;j++)if(j>=1&&j<=count)flags[j-1]=true;continue;}
            n=parseInt(p,10);if(!isNaN(n)&&n>=1&&n<=count)flags[n-1]=true;
        }
        return flags;
    }

    function countTrue(a){var n=0,i;for(i=0;i<a.length;i++)if(a[i])n++;return n;}

    function formatNumberList(a){return a&&a.length?a.join(", "):"keine";}

    function cleanHeadingText(s){
        s=restoreCdata(xmlUnescape(String(s||"")));
        s=s.replace(/[\r\n\t]+/g," ").replace(/<[^>]+>/g,"");
        s=s.replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g,"");
        return trim(s.replace(/\s+/g," "));
    }

    function normalizeTitle(s){return cleanHeadingText(s).toLowerCase().replace(/[׳״'’“”".,:;()\[\]{}\-–—]+/g," ").replace(/\s+/g," ").replace(/^\s+|\s+$/g,"");}

    function stripHebrewMarks(s){return String(s||"").replace(/[\u0591-\u05C7]/g,"");}

    function normalizeHebrewWords(s){
        s=stripHebrewMarks(cleanHeadingText(s));
        s=s.replace(/[^\u05D0-\u05EA ]+/g," ").replace(/\s+/g," ");
        return trim(s);
    }

    function normalizeEnglishWords(s){
        s=cleanHeadingText(s).toLowerCase();
        s=s.replace(/parashah|parashat/g," ");
        s=s.replace(/[^a-z]+/g," ").replace(/\s+/g," ");
        return trim(s);
    }

    function containsHebrew(s){return /[\u0590-\u05FF]/.test(String(s||""));}

    function cleanTemplateSeparators(s){
        s=String(s||"").replace(/\s+/g," ");
        s=s.replace(/·\s*·+/g,"·");
        s=s.replace(/^\s*·\s*|\s*·\s*$/g,"");
        return trim(s);
    }

    function replaceAllLiteral(s,find,repl){return String(s).split(find).join(String(repl));}

    function mm(v){return String(Number(v))+" mm";}
    function toMm(v){var n=Number(v);if(isNaN(n))return 0;return n/2.834645669291339;}
    function horizontalNearMm(y1,y2,target,tol){
        var a=Number(y1),b=Number(y2),pt=2.834645669291339;
        if(isNaN(a)||isNaN(b))return false;
        if(Math.abs(a-b)<tol && Math.abs(((a+b)/2)-target)<tol)return true;
        if(Math.abs((a-b)/pt)<tol && Math.abs((((a+b)/2)/pt)-target)<tol)return true;
        return false;
    }
    function spanAtLeastMm(x1,x2,minMm){
        var d=Math.abs(Number(x2)-Number(x1)),pt=2.834645669291339;
        if(isNaN(d))return false;
        return d>=minMm || (d/pt)>=minMm;
    }

    function numberValue(v,fallback){var n=parseFloat(String(v||"").replace(",","."));return isNaN(n)?fallback:n;}
    function positiveNumber(v,fallback){var n=numberValue(v,fallback);return n>0?n:fallback;}
    function clamp(n,a,b){return Math.max(a,Math.min(b,n));}
    function trim(s){return String(s||"").replace(/^\s+|\s+$/g,"");}
    function timestamp(){var d=new Date();return d.getFullYear()+pad2(d.getMonth()+1)+pad2(d.getDate())+"-"+pad2(d.getHours())+pad2(d.getMinutes())+pad2(d.getSeconds());}
    function pad2(n){n=String(n);return n.length<2?"0"+n:n;}
    function errorText(e){return e&&e.message?e.message:String(e);}

    function readUTF8(file){file.encoding="UTF-8";if(!file.open("r"))throw new Error("Datei kann nicht geöffnet werden: "+file.fsName);var s=file.read();file.close();if(s.charCodeAt(0)===0xFEFF)s=s.substring(1);return s;}
    function xmlUnescape(s){return String(s||"").replace(/&quot;/g,'"').replace(/&gt;/g,">").replace(/&lt;/g,"<").replace(/&amp;/g,"&");}
    function restoreCdata(s){s=trim(String(s||""));if(/^<!\[CDATA\[/.test(s)&&/\]\]>$/.test(s)){s=s.replace(/^<!\[CDATA\[/,"").replace(/\]\]>$/,"").replace(/\]\]\]\]><!\[CDATA\[>/g,"]]>");}return s;}

    function uniqueFile(file){
        if(!file.exists)return file;
        var name=file.displayName,match=/^(.*?)(\.[^.]+)?$/.exec(name),base=match?match[1]:name,ext=(match&&match[2])?match[2]:"",n=2,candidate;
        do{candidate=new File(file.parent.fsName+"/"+base+"_"+n+ext);n++;}while(candidate.exists);
        return candidate;
    }

    // =====================================================================
    // UI styling helpers
    // =====================================================================

    function addWorkflowLegend(parent,items){
        var p=parent.add("panel",undefined,"Farblegende · gleicher Ablauf = gleiche Farbe");
        p.orientation="row";p.alignChildren=["left","center"];p.margins=7;p.spacing=16;
        var i,item,st;
        for(i=0;i<items.length;i++){
            item=items[i];st=p.add("statictext",undefined,"● "+item.label);
            styleWorkflowText(st,item.color,item.tip||"");
        }
        return p;
    }

    function styleWorkflowText(control,color,tip){
        if(tip)control.helpTip=tip;
        try{
            var g=control.graphics;
            g.foregroundColor=g.newPen(g.PenType.SOLID_COLOR,color,1);
            try{g.font=ScriptUI.newFont(g.font.name,"BOLD",g.font.size);}catch(_font){}
        }catch(_){}
        return control;
    }

    function styleWorkflowButton(btn,color,tip){
        btn.__bihWorkflowColor=color;
        if(tip)btn.helpTip=tip;
        try{
            var gg=btn.graphics;
            gg.backgroundColor=gg.newBrush(gg.BrushType.SOLID_COLOR,color);
            gg.foregroundColor=gg.newPen(gg.PenType.SOLID_COLOR,UI_TEXT_LIGHT,1);
        }catch(_direct){}
        btn.onDraw=function(){
            try{
                var g=this.graphics;
                var ww=(this.size&&this.size.width!==undefined)?this.size.width:this.size[0];
                var hh=(this.size&&this.size.height!==undefined)?this.size.height:this.size[1];
                var c=this.enabled?this.__bihWorkflowColor:UI_DISABLED;
                var brush=g.newBrush(g.BrushType.SOLID_COLOR,c);
                var border=g.newPen(g.PenType.SOLID_COLOR,[0.12,0.12,0.12,1],1);
                var textPen=g.newPen(g.PenType.SOLID_COLOR,this.enabled?UI_TEXT_LIGHT:[0.72,0.72,0.72,1],1);
                g.rectPath(0,0,ww,hh);g.fillPath(brush);g.strokePath(border);
                var txt=String(this.text||"");var m=g.measureString(txt);var x=Math.max(4,(ww-m[0])/2);var y=Math.max(2,(hh-m[1])/2);
                g.drawString(txt,textPen,x,y);
            }catch(_draw){}
        };
        return btn;
    }

})();

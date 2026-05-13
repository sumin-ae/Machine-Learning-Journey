(function GridBuilderPro(thisObj) {

    function buildUI(thisObj) {
        var win = (thisObj instanceof Panel)
            ? thisObj
            : new Window("palette", "Grid Builder Pro | Created by Sumin", undefined, {resizeable:true});

        win.orientation = "column";
        win.alignChildren = ["fill","top"];

        // ===== HEADER =====
        var header = win.add("group");
        header.add("statictext", undefined, "GRID BUILDER PRO");
        header.add("statictext", undefined, "Created by Sumin");

        // ===== GRID TYPE =====
        var gridType = win.add("dropdownlist", undefined, ["Rectangular", "Radial", "Path"]);
        gridType.selection = 0;

        // ===== BUTTONS =====
        var createBtn = win.add("button", undefined, "Create Grid");
        var updateBtn = win.add("button", undefined, "Update Grid");

        // ===== ACTION =====
        createBtn.onClick = function () {
            createGrid(gridType.selection.index);
        };

        updateBtn.onClick = function () {
            alert("Update works automatically via expressions.");
        };

        win.layout.layout(true);
        return win;
    }

    // =========================
    // CORE FUNCTION
    // =========================
    function createGrid(modeIndex) {

        var comp = app.project.activeItem;

        if (!(comp instanceof CompItem)) {
            alert("Open a composition.");
            return;
        }

        var layers = comp.selectedLayers;

        if (layers.length === 0) {
            alert("Select layers first.");
            return;
        }

        app.beginUndoGroup("Grid Builder Pro");

        // Remove old controller if exists
        var old = comp.layer("GRID_CTRL");
        if (old) old.remove();

        // ===== CREATE NULL =====
        var ctrl = comp.layers.addNull();
        ctrl.name = "GRID_CTRL";

        var fx = ctrl.property("Effects");

        function slider(name, val) {
            var s = fx.addProperty("ADBE Slider Control");
            s.name = name;
            s.property("Slider").setValue(val);
        }

        function dropdown(name, items) {
            var d = fx.addProperty("ADBE Dropdown Control");
            d.name = name;
            d.property(1).setPropertyParameters(items);
        }

        // ===== CONTROLS =====
        dropdown("Mode", ["Rectangular","Radial","Path"]);

        slider("Rows", 3);
        slider("Columns", 3);
        slider("Spacing X", 250);
        slider("Spacing Y", 250);

        slider("Radius", 400);
        slider("Angle Spread", 360);
        slider("Start Angle", 0);

        slider("Offset X", 0);
        slider("Offset Y", 0);

        slider("Random Seed", 1);

        // ===== APPLY EXPRESSIONS =====
        for (var i = 0; i < layers.length; i++) {

            var expr =
            "ctrl = thisComp.layer('GRID_CTRL');\n" +
            "mode = ctrl.effect('Mode')('Menu');\n" +

            "rows = Math.max(1, Math.floor(ctrl.effect('Rows')('Slider')));\n" +
            "cols = Math.max(1, Math.floor(ctrl.effect('Columns')('Slider')));\n" +

            "sx = ctrl.effect('Spacing X')('Slider');\n" +
            "sy = ctrl.effect('Spacing Y')('Slider');\n" +

            "radius = ctrl.effect('Radius')('Slider');\n" +
            "spread = radians(ctrl.effect('Angle Spread')('Slider'));\n" +
            "start = radians(ctrl.effect('Start Angle')('Slider'));\n" +

            "ox = ctrl.effect('Offset X')('Slider');\n" +
            "oy = ctrl.effect('Offset Y')('Slider');\n" +

            "seedRandom(ctrl.effect('Random Seed')('Slider'), true);\n" +

            "i = index - 1;\n" +
            "n = thisComp.numLayers;\n" +

            "// ===== RECTANGULAR =====\n" +
            "if (mode == 1) {\n" +
            " col = i % cols;\n" +
            " row = Math.floor(i / cols);\n" +

            " totalW = (cols - 1) * sx;\n" +
            " totalH = (rows - 1) * sy;\n" +

            " x = col * sx - totalW/2;\n" +
            " y = row * sy - totalH/2;\n" +

            " [x+ox, y+oy];\n" +
            "}\n" +

            "// ===== RADIAL =====\n" +
            "else if (mode == 2) {\n" +
            " t = i / Math.max(n-1,1);\n" +
            " ang = start + spread * t;\n" +

            " x = radius * Math.cos(ang);\n" +
            " y = radius * Math.sin(ang);\n" +

            " [x+ox, y+oy];\n" +
            "}\n" +

            "// ===== PATH (SAFE FALLBACK LINE) =====\n" +
            "else {\n" +
            " t = i / Math.max(n-1,1);\n" +
            " x = linear(t, 0, 1, -400, 400);\n" +
            " y = 0;\n" +
            " [x+ox, y+oy];\n" +
            "}";

            layers[i].property("Position").expression = expr;
        }

        app.endUndoGroup();
    }

    var myUI = buildUI(thisObj);

    if (myUI instanceof Window) {
        myUI.center();
        myUI.show();
    }

})(this);
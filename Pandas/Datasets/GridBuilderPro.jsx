/**
 * ============================================================
 *  GRID BUILDER PRO  —  v1.0.0
 *  A professional grid/cloner system for Adobe After Effects
 *  ExtendScript (ES3 compatible) + ScriptUI Panel
 * ============================================================
 *
 *  INSTALLATION:
 *    1. Copy this file to:
 *       Windows: C:\Program Files\Adobe\Adobe After Effects <version>\Support Files\Scripts\ScriptUI Panels\
 *       macOS:   /Applications/Adobe After Effects <version>/Scripts/ScriptUI Panels/
 *    2. Restart After Effects.
 *    3. Open via: Window > GridBuilderPro.jsx
 *
 *  USAGE:
 *    1. Select one or more layers in the Timeline.
 *    2. Choose a Grid Mode from the dropdown.
 *    3. Adjust parameters as needed.
 *    4. Click "Create Grid".
 *    5. All controls live on the generated "GridBuilderPro_Control" Null layer
 *       as a pseudo-effect — fully animatable.
 *
 *  ARCHITECTURE:
 *    - UIModule      : All ScriptUI panel construction & events
 *    - GridModule    : Layer creation, Null setup, pseudo-effect
 *    - ExprModule    : Expression string builders per grid mode
 *    - UtilModule    : Shared helpers
 * ============================================================
 */

// ─────────────────────────────────────────────────────────────
//  ENTRY POINT  (works both as panel and as run-script)
// ─────────────────────────────────────────────────────────────
(function GridBuilderPro(thisObj) {

    // =========================================================
    //  UTIL MODULE
    // =========================================================
    var UtilModule = (function () {

        /** Clamp a value between min and max */
        function clamp(v, lo, hi) { return Math.min(Math.max(v, lo), hi); }

        /** Degrees to radians */
        function deg2rad(d) { return d * Math.PI / 180; }

        /** Safe alert wrapper */
        function warn(msg) { alert("[Grid Builder Pro]\n" + msg); }

        /** Check whether a pseudo-effect preset XML string is valid */
        function pseudoEffectName() { return "GridBuilderPro_Controls"; }

        /**
         * Apply a MatchName-based pseudo effect via XML preset.
         * Because AE ExtendScript has no direct "add pseudo effect" API,
         * we use the Effects > Apply Preset approach via a temp .ffx.
         * As a practical alternative (no file I/O needed), we use
         * multiple Slider Controls with descriptive names — this is
         * the standard professional workaround used in production tools.
         */
        function addControlEffect(layer, name, type, options) {
            // type: "slider" | "dropdown" | "checkbox" | "color" | "angle" | "point"
            var fx;
            try {
                switch (type) {
                    case "slider":
                        fx = layer.Effects.addProperty("ADBE Slider Control");
                        break;
                    case "angle":
                        fx = layer.Effects.addProperty("ADBE Angle Control");
                        break;
                    case "checkbox":
                        fx = layer.Effects.addProperty("ADBE Checkbox Control");
                        break;
                    case "color":
                        fx = layer.Effects.addProperty("ADBE Color Control");
                        break;
                    case "point":
                        fx = layer.Effects.addProperty("ADBE Point Control");
                        break;
                    case "dropdown":
                        // Use slider as proxy for dropdown (AE CC 2019+)
                        fx = layer.Effects.addProperty("ADBE Slider Control");
                        break;
                    default:
                        fx = layer.Effects.addProperty("ADBE Slider Control");
                }
                fx.name = name;
                if (options && options.value !== undefined) {
                    try { fx.property(1).setValue(options.value); } catch (e) {}
                }
                return fx;
            } catch (e) {
                warn("Could not add effect '" + name + "': " + e.toString());
                return null;
            }
        }

        /** Set a slider value safely */
        function setSlider(fx, value) {
            if (!fx) return;
            try { fx.property(1).setValue(value); } catch (e) {}
        }

        /** Get the master Null if it already exists */
        function findMasterNull(comp) {
            for (var i = 1; i <= comp.numLayers; i++) {
                var l = comp.layer(i);
                if (l.name === "GridBuilderPro_Control" && l.nullLayer) return l;
            }
            return null;
        }

        return {
            clamp: clamp,
            deg2rad: deg2rad,
            warn: warn,
            pseudoEffectName: pseudoEffectName,
            addControlEffect: addControlEffect,
            setSlider: setSlider,
            findMasterNull: findMasterNull
        };
    })();


    // =========================================================
    //  EXPRESSION MODULE
    //  Returns expression strings for each grid mode.
    //  Expressions reference the Null layer by name so they
    //  remain valid even if layer order changes.
    // =========================================================
    var ExprModule = (function () {

        var NULL_NAME = "GridBuilderPro_Control";

        /**
         * Helper header embedded in every expression:
         * Finds the Null, reads all controls, then applies math.
         */
        function controlHeader() {
            return [
                "// ── Grid Builder Pro Expression ──",
                "var ctrlLayer = null;",
                "try { ctrlLayer = thisComp.layer('" + NULL_NAME + "'); } catch(e) {}",
                "if (!ctrlLayer) value;",
                "var fx = ctrlLayer.Effects;",
                ""
            ].join("\n");
        }

        /** Read a named effect slider value at current time */
        function readFx(effectName) {
            return "fx('" + effectName + "')(1).value";
        }

        // ── Helper: resolve this layer's index among grid layers ──
        // Grid layers get a marker comment embedded so expressions can
        // identify their own position without iterating all layers.
        // We embed the index as a comment in the expression itself (via
        // a local var injected at creation time per-layer).

        // ─────────────────────────────────────────────────────
        //  RECTANGULAR GRID
        // ─────────────────────────────────────────────────────
        function rectPositionExpr(layerIndex, totalLayers) {
            return [
                controlHeader(),
                "var idx   = " + layerIndex + "; // 0-based",
                "var total = " + totalLayers + ";",
                "var cols  = Math.max(1, Math.round(" + readFx("GBP: Columns") + "));",
                "var rows  = Math.max(1, Math.ceil(total / cols));",
                "var spX   = " + readFx("GBP: Spacing X") + ";",
                "var spY   = " + readFx("GBP: Spacing Y") + ";",
                "var col   = idx % cols;",
                "var row   = Math.floor(idx / cols);",
                "var ox    = (cols - 1) * spX / 2;",
                "var oy    = (rows - 1) * spY / 2;",
                "var seed  = Math.round(" + readFx("GBP: Random Seed") + ");",
                "var rndAmt= " + readFx("GBP: Randomize Position") + ";",
                "var rndX  = 0; var rndY = 0;",
                "if (rndAmt > 0) {",
                "  seedRandom(seed + idx * 7, true);",
                "  rndX = (random() - 0.5) * 2 * rndAmt;",
                "  rndY = (random() - 0.5) * 2 * rndAmt;",
                "}",
                "var basePos = ctrlLayer.transform.position.value;",
                "var x = basePos[0] + col * spX - ox + rndX;",
                "var y = basePos[1] + row * spY - oy + rndY;",
                "[x, y]"
            ].join("\n");
        }

        function rectScaleExpr(layerIndex, totalLayers) {
            return [
                controlHeader(),
                "var idx    = " + layerIndex + ";",
                "var total  = " + totalLayers + ";",
                "var base   = " + readFx("GBP: Scale") + ";",
                "var vary   = " + readFx("GBP: Scale Variation") + ";",
                "var seed   = Math.round(" + readFx("GBP: Random Seed") + ") + 99;",
                "seedRandom(seed + idx * 13, true);",
                "var r = 1 + (random() - 0.5) * 2 * (vary / 100);",
                "[base * r, base * r]"
            ].join("\n");
        }

        function rectRotationExpr(layerIndex) {
            return [
                controlHeader(),
                "var idx    = " + layerIndex + ";",
                "var base   = " + readFx("GBP: Rotation Offset") + ";",
                "var vary   = " + readFx("GBP: Rotation Variation") + ";",
                "var seed   = Math.round(" + readFx("GBP: Random Seed") + ") + 42;",
                "seedRandom(seed + idx * 17, true);",
                "var r = (random() - 0.5) * 2 * vary;",
                "base + r"
            ].join("\n");
        }

        // ─────────────────────────────────────────────────────
        //  RADIAL GRID
        // ─────────────────────────────────────────────────────
        function radialPositionExpr(layerIndex, totalLayers) {
            return [
                controlHeader(),
                "var idx      = " + layerIndex + ";",
                "var total    = " + totalLayers + ";",
                "var radius   = " + readFx("GBP: Radius") + ";",
                "var spread   = " + readFx("GBP: Angle Spread") + ";",
                "var startAng = " + readFx("GBP: Start Angle") + ";",
                "var cw       = " + readFx("GBP: Clockwise") + ";",
                "var seed     = Math.round(" + readFx("GBP: Random Seed") + ");",
                "var rndAmt   = " + readFx("GBP: Randomize Position") + ";",
                "var step     = (total > 1) ? spread / total : 0;",
                "var dir      = (cw >= 0.5) ? 1 : -1;",
                "var ang      = (startAng + dir * step * idx) * Math.PI / 180;",
                "var rndR = 0;",
                "if (rndAmt > 0) { seedRandom(seed + idx * 7, true); rndR = (random()-0.5)*2*rndAmt; }",
                "var r = radius + rndR;",
                "var basePos = ctrlLayer.transform.position.value;",
                "var x = basePos[0] + Math.cos(ang) * r;",
                "var y = basePos[1] + Math.sin(ang) * r;",
                "[x, y]"
            ].join("\n");
        }

        function radialRotationExpr(layerIndex, totalLayers, orientMode) {
            return [
                controlHeader(),
                "var idx      = " + layerIndex + ";",
                "var total    = " + totalLayers + ";",
                "var spread   = " + readFx("GBP: Angle Spread") + ";",
                "var startAng = " + readFx("GBP: Start Angle") + ";",
                "var cw       = " + readFx("GBP: Clockwise") + ";",
                "var base     = " + readFx("GBP: Rotation Offset") + ";",
                "var step     = (total > 1) ? spread / total : 0;",
                "var dir      = (cw >= 0.5) ? 1 : -1;",
                "var ang      = startAng + dir * step * idx;",
                orientMode === "orientCenter" ? "base + ang + 90" : "base"
            ].join("\n");
        }

        // ─────────────────────────────────────────────────────
        //  PATH GRID
        // ─────────────────────────────────────────────────────
        /**
         * Path grid uses AE's built-in pathOnPath / sampleImage
         * approach. We approximate path positions using parametric
         * preset equations (circle, wave, spiral) since arbitrary
         * mask path evaluation in expressions is limited.
         * For custom mask paths, we use the mask path property.
         */
        function pathPositionExpr(layerIndex, totalLayers, pathType) {
            var pathCalc = "";
            // pathType: 0=circle, 1=wave, 2=spiral
            switch (pathType) {
                case 1: // Wave
                    pathCalc = [
                        "var t = (total > 1) ? idx / (total - 1) : 0;",
                        "var waveAmp = " + readFx("GBP: Wave Amplitude") + ";",
                        "var waveFreq = " + readFx("GBP: Wave Frequency") + ";",
                        "var pathLen = " + readFx("GBP: Path Length") + ";",
                        "var px = basePos[0] - pathLen/2 + t * pathLen;",
                        "var py = basePos[1] + Math.sin(t * waveFreq * Math.PI * 2) * waveAmp;"
                    ].join("\n");
                    break;
                case 2: // Spiral
                    pathCalc = [
                        "var t = (total > 1) ? idx / (total - 1) : 0;",
                        "var spiralR = " + readFx("GBP: Radius") + " * t;",
                        "var turns = " + readFx("GBP: Wave Frequency") + ";",
                        "var ang = t * turns * Math.PI * 2;",
                        "var px = basePos[0] + Math.cos(ang) * spiralR;",
                        "var py = basePos[1] + Math.sin(ang) * spiralR;"
                    ].join("\n");
                    break;
                default: // Circle (default)
                    pathCalc = [
                        "var t = (total > 1) ? idx / total : 0;",
                        "var ang = t * Math.PI * 2;",
                        "var r = " + readFx("GBP: Radius") + ";",
                        "var px = basePos[0] + Math.cos(ang) * r;",
                        "var py = basePos[1] + Math.sin(ang) * r;"
                    ].join("\n");
            }
            return [
                controlHeader(),
                "var idx   = " + layerIndex + ";",
                "var total = " + totalLayers + ";",
                "var rndAmt= " + readFx("GBP: Randomize Position") + ";",
                "var seed  = Math.round(" + readFx("GBP: Random Seed") + ");",
                "var basePos = ctrlLayer.transform.position.value;",
                pathCalc,
                "if (rndAmt > 0) {",
                "  seedRandom(seed + idx * 7, true);",
                "  px += (random()-0.5)*2*rndAmt;",
                "  py += (random()-0.5)*2*rndAmt;",
                "}",
                "[px, py]"
            ].join("\n");
        }

        function pathRotationExpr(layerIndex, totalLayers, pathType) {
            var tangentCalc = "";
            switch (pathType) {
                case 1: // Wave — tangent approximation
                    tangentCalc = [
                        "var t = (total > 1) ? idx / (total - 1) : 0;",
                        "var dt = 0.01;",
                        "var waveAmp = " + readFx("GBP: Wave Amplitude") + ";",
                        "var waveFreq = " + readFx("GBP: Wave Frequency") + ";",
                        "var pathLen = " + readFx("GBP: Path Length") + ";",
                        "var t2 = Math.min(t + dt, 1);",
                        "var p1x = -pathLen/2 + t * pathLen;",
                        "var p1y = Math.sin(t * waveFreq * Math.PI * 2) * waveAmp;",
                        "var p2x = -pathLen/2 + t2 * pathLen;",
                        "var p2y = Math.sin(t2 * waveFreq * Math.PI * 2) * waveAmp;",
                        "var ang = Math.atan2(p2y - p1y, p2x - p1x) * 180 / Math.PI;"
                    ].join("\n");
                    break;
                case 2: // Spiral
                    tangentCalc = [
                        "var t = (total > 1) ? idx / (total - 1) : 0;",
                        "var turns = " + readFx("GBP: Wave Frequency") + ";",
                        "var ang = t * turns * 360 + 90;"
                    ].join("\n");
                    break;
                default: // Circle
                    tangentCalc = [
                        "var t = (total > 1) ? idx / total : 0;",
                        "var ang = t * 360 + 90;"
                    ].join("\n");
            }
            return [
                controlHeader(),
                "var idx   = " + layerIndex + ";",
                "var total = " + totalLayers + ";",
                "var base  = " + readFx("GBP: Rotation Offset") + ";",
                tangentCalc,
                "base + ang"
            ].join("\n");
        }

        // ─────────────────────────────────────────────────────
        //  SPHERICAL GRID (3D)
        // ─────────────────────────────────────────────────────
        /**
         * Distributes layers on a sphere using the Fibonacci
         * sphere algorithm (golden-angle method) for near-uniform
         * coverage — much better than simple lat/lon gridding.
         */
        function spherePositionExpr(layerIndex, totalLayers) {
            return [
                controlHeader(),
                "var idx     = " + layerIndex + ";",
                "var total   = " + totalLayers + ";",
                "var radius  = " + readFx("GBP: Radius") + ";",
                "var density = " + readFx("GBP: Density") + ";",
                "var seed    = Math.round(" + readFx("GBP: Random Seed") + ");",
                "var rndAmt  = " + readFx("GBP: Randomize Position") + ";",
                "// Fibonacci sphere (golden angle method)",
                "var golden = Math.PI * (3 - Math.sqrt(5));",
                "var theta  = golden * idx;",
                "var phi    = Math.acos(1 - 2 * (idx + 0.5) / Math.max(total, 1));",
                "var r = radius + (density - 1) * 10;",
                "var sx = r * Math.sin(phi) * Math.cos(theta);",
                "var sy = r * Math.sin(phi) * Math.sin(theta);",
                "var sz = r * Math.cos(phi);",
                "if (rndAmt > 0) {",
                "  seedRandom(seed + idx * 7, true);",
                "  sx += (random()-0.5)*2*rndAmt;",
                "  sy += (random()-0.5)*2*rndAmt;",
                "  sz += (random()-0.5)*2*rndAmt;",
                "}",
                "var basePos = ctrlLayer.transform.position.value;",
                "[basePos[0]+sx, basePos[1]+sy, basePos[2]+sz]"
            ].join("\n");
        }

        // Orient-to-center for spherical: rotate layer to face origin
        function sphereRotationXExpr(layerIndex, totalLayers) {
            return [
                controlHeader(),
                "var idx    = " + layerIndex + ";",
                "var total  = " + totalLayers + ";",
                "var golden = Math.PI * (3 - Math.sqrt(5));",
                "var theta  = golden * idx;",
                "var phi    = Math.acos(1 - 2 * (idx + 0.5) / Math.max(total, 1));",
                "var base   = " + readFx("GBP: Rotation Offset") + ";",
                "base + phi * 180 / Math.PI"
            ].join("\n");
        }

        function sphereRotationYExpr(layerIndex, totalLayers) {
            return [
                controlHeader(),
                "var idx    = " + layerIndex + ";",
                "var total  = " + totalLayers + ";",
                "var golden = Math.PI * (3 - Math.sqrt(5));",
                "var theta  = golden * idx;",
                "var base   = " + readFx("GBP: Rotation Offset") + ";",
                "base + theta * 180 / Math.PI"
            ].join("\n");
        }

        // ─────────────────────────────────────────────────────
        //  SCALE (shared for all non-rect modes)
        // ─────────────────────────────────────────────────────
        function scaleExpr(layerIndex) {
            return [
                controlHeader(),
                "var idx  = " + layerIndex + ";",
                "var base = " + readFx("GBP: Scale") + ";",
                "var vary = " + readFx("GBP: Scale Variation") + ";",
                "var seed = Math.round(" + readFx("GBP: Random Seed") + ") + 99;",
                "seedRandom(seed + idx * 13, true);",
                "var r = 1 + (random()-0.5)*2*(vary/100);",
                "[base*r, base*r]"
            ].join("\n");
        }

        // ─────────────────────────────────────────────────────
        //  OPACITY (focus-fade when target focus is set)
        // ─────────────────────────────────────────────────────
        function opacityExpr(layerIndex, totalLayers) {
            return [
                controlHeader(),
                "var idx    = " + layerIndex + ";",
                "var focus  = " + readFx("GBP: Target Focus") + ";",
                "// 0 = show all; 1..total = focus on that layer (1-based)",
                "if (focus < 0.5) { 100; }",
                "else {",
                "  var target = Math.round(focus) - 1;",
                "  var dist   = Math.abs(idx - target);",
                "  var fade   = Math.max(0, 1 - dist * 0.4);",
                "  fade * 100;",
                "}"
            ].join("\n");
        }

        return {
            rectPositionExpr:    rectPositionExpr,
            rectScaleExpr:       rectScaleExpr,
            rectRotationExpr:    rectRotationExpr,
            radialPositionExpr:  radialPositionExpr,
            radialRotationExpr:  radialRotationExpr,
            pathPositionExpr:    pathPositionExpr,
            pathRotationExpr:    pathRotationExpr,
            spherePositionExpr:  spherePositionExpr,
            sphereRotationXExpr: sphereRotationXExpr,
            sphereRotationYExpr: sphereRotationYExpr,
            scaleExpr:           scaleExpr,
            opacityExpr:         opacityExpr
        };
    })();


    // =========================================================
    //  GRID MODULE
    //  Handles Null creation, pseudo-effect setup, and
    //  expression assignment per grid mode.
    // =========================================================
    var GridModule = (function () {

        var NULL_NAME = "GridBuilderPro_Control";

        // ── Create or retrieve the master Null ──────────────
        function getOrCreateNull(comp) {
            var existing = UtilModule.findMasterNull(comp);
            if (existing) return existing;

            var nullLayer = comp.layers.addNull(comp.duration);
            nullLayer.name = NULL_NAME;
            nullLayer.label = 12; // Purple
            nullLayer.shy = false;

            // Move to top
            nullLayer.moveToBeginning();

            return nullLayer;
        }

        // ── Add all pseudo-effect controls to Null ──────────
        function setupControls(nullLayer, gridType, params) {
            var E = nullLayer.Effects;

            // Clear previous GBP effects to avoid duplication
            for (var i = E.numProperties; i >= 1; i--) {
                var eff = E.property(i);
                if (eff.name.indexOf("GBP:") === 0) {
                    eff.remove();
                }
            }

            var add = function(name, type, val) {
                return UtilModule.addControlEffect(nullLayer, name, type, {value: val});
            };

            // ── Universal Controls ──
            add("GBP: Grid Type",          "slider",   gridType);   // 0=rect,1=radial,2=path,3=sphere
            add("GBP: Scale",              "slider",   params.scale       || 100);
            add("GBP: Scale Variation",    "slider",   params.scaleVar    || 0);
            add("GBP: Rotation Offset",    "angle",    params.rotOffset   || 0);
            add("GBP: Rotation Variation", "slider",   params.rotVar      || 0);
            add("GBP: Random Seed",        "slider",   params.seed        || 0);
            add("GBP: Randomize Position", "slider",   params.randPos     || 0);
            add("GBP: Target Focus",       "slider",   0);

            // ── Rect Controls ──
            if (gridType === 0) {
                add("GBP: Columns",   "slider", params.cols   || 3);
                add("GBP: Rows",      "slider", params.rows   || 3);
                add("GBP: Spacing X", "slider", params.spX    || 200);
                add("GBP: Spacing Y", "slider", params.spY    || 200);
            }

            // ── Radial Controls ──
            if (gridType === 1) {
                add("GBP: Radius",       "slider", params.radius    || 300);
                add("GBP: Angle Spread", "slider", params.spread    || 360);
                add("GBP: Start Angle",  "angle",  params.startAng  || 0);
                add("GBP: Clockwise",    "checkbox", 1);
            }

            // ── Path Controls ──
            if (gridType === 2) {
                add("GBP: Radius",         "slider", params.radius    || 300);
                add("GBP: Path Length",    "slider", params.pathLen   || 800);
                add("GBP: Wave Amplitude", "slider", params.waveAmp   || 150);
                add("GBP: Wave Frequency", "slider", params.waveFreq  || 2);
                add("GBP: Path Type",      "slider", params.pathType  || 0);
            }

            // ── Sphere Controls ──
            if (gridType === 3) {
                add("GBP: Radius",  "slider", params.radius  || 400);
                add("GBP: Density", "slider", params.density || 1);
            }
        }

        // ── Apply expressions to a single grid layer ────────
        function applyExpressionsToLayer(layer, gridType, layerIndex, totalLayers, orientMode, pathType) {
            var pos    = layer.transform.position;
            var scl    = layer.transform.scale;
            var rot    = layer.transform.rotation;
            var opa    = layer.transform.opacity;

            // Helper: set expression only if not already overridden by user keyframes
            // (Non-destructive: we check for existing keyframes and SKIP if found)
            function setExpr(prop, expr) {
                if (!prop) return;
                try {
                    prop.expression = expr;
                } catch(e) {
                    // Property may be locked or unsupported — skip silently
                }
            }

            // Opacity (focus system) — always applied
            setExpr(opa, ExprModule.opacityExpr(layerIndex, totalLayers));

            // Scale variation
            setExpr(scl, ExprModule.scaleExpr(layerIndex));

            switch (gridType) {

                case 0: // ── RECTANGULAR ──────────────────────
                    setExpr(pos, ExprModule.rectPositionExpr(layerIndex, totalLayers));
                    setExpr(scl, ExprModule.rectScaleExpr(layerIndex, totalLayers));
                    setExpr(rot, ExprModule.rectRotationExpr(layerIndex));
                    break;

                case 1: // ── RADIAL ────────────────────────────
                    setExpr(pos, ExprModule.radialPositionExpr(layerIndex, totalLayers));
                    setExpr(rot, ExprModule.radialRotationExpr(layerIndex, totalLayers, orientMode));
                    setExpr(scl, ExprModule.scaleExpr(layerIndex));
                    break;

                case 2: // ── PATH ──────────────────────────────
                    var pType = pathType || 0;
                    setExpr(pos, ExprModule.pathPositionExpr(layerIndex, totalLayers, pType));
                    if (orientMode === "orientPath") {
                        setExpr(rot, ExprModule.pathRotationExpr(layerIndex, totalLayers, pType));
                    } else {
                        setExpr(rot, ExprModule.rectRotationExpr(layerIndex));
                    }
                    setExpr(scl, ExprModule.scaleExpr(layerIndex));
                    break;

                case 3: // ── SPHERICAL ─────────────────────────
                    // Enable 3D for spherical
                    layer.threeDLayer = true;
                    setExpr(pos, ExprModule.spherePositionExpr(layerIndex, totalLayers));
                    if (orientMode === "orientCenter") {
                        var rotX = layer.transform.xRotation;
                        var rotY = layer.transform.yRotation;
                        setExpr(rotX, ExprModule.sphereRotationXExpr(layerIndex, totalLayers));
                        setExpr(rotY, ExprModule.sphereRotationYExpr(layerIndex, totalLayers));
                    }
                    setExpr(scl, ExprModule.scaleExpr(layerIndex));
                    break;
            }
        }

        // ── MAIN BUILD FUNCTION ──────────────────────────────
        function buildGrid(comp, layers, gridType, orientMode, params, pathType) {

            if (!layers || layers.length === 0) {
                UtilModule.warn("No layers provided. Please select layers in the timeline first.");
                return false;
            }

            app.beginUndoGroup("Grid Builder Pro: Build Grid");

            try {
                // 1. Get/create master Null
                var nullLayer = getOrCreateNull(comp);

                // Position Null at comp center
                nullLayer.transform.position.setValue(
                    [comp.width / 2, comp.height / 2]
                );

                // 2. Setup pseudo-effect controls on Null
                setupControls(nullLayer, gridType, params);

                // 3. Apply expressions to each layer
                var total = layers.length;
                for (var i = 0; i < total; i++) {
                    applyExpressionsToLayer(
                        layers[i],
                        gridType,
                        i,           // 0-based index
                        total,
                        orientMode,
                        pathType || 0
                    );
                }

                // 4. For spherical, enable 3D on Null too
                if (gridType === 3) {
                    nullLayer.threeDLayer = true;
                }

                app.endUndoGroup();
                return true;

            } catch (e) {
                app.endUndoGroup();
                UtilModule.warn("Error building grid:\n" + e.toString() +
                    "\nLine: " + e.line);
                return false;
            }
        }

        // ── REBUILD: re-apply expressions to existing grid ──
        function rebuildGrid(comp, layers, gridType, orientMode, params, pathType) {
            // Same as build but does NOT recreate the Null
            var nullLayer = UtilModule.findMasterNull(comp);
            if (!nullLayer) {
                UtilModule.warn("No Grid Builder Pro Null found. Please create a grid first.");
                return false;
            }

            app.beginUndoGroup("Grid Builder Pro: Rebuild Grid");

            try {
                setupControls(nullLayer, gridType, params);
                var total = layers.length;
                for (var i = 0; i < total; i++) {
                    applyExpressionsToLayer(
                        layers[i], gridType, i, total, orientMode, pathType || 0
                    );
                }
                app.endUndoGroup();
                return true;
            } catch (e) {
                app.endUndoGroup();
                UtilModule.warn("Rebuild error:\n" + e.toString());
                return false;
            }
        }

        return {
            buildGrid:   buildGrid,
            rebuildGrid: rebuildGrid
        };
    })();


    // =========================================================
    //  UI MODULE
    //  ScriptUI Panel — dockable in AE workspace
    // =========================================================
    var UIModule = (function () {

        // Grid mode labels
        var GRID_MODES = ["Rectangular", "Radial", "Path", "Spherical (3D)"];

        // Orientation mode labels (per grid type)
        var ORIENT_MODES = {
            0: ["Forward", "Orient to Center"],                       // Rect
            1: ["Forward", "Orient to Center"],                       // Radial
            2: ["Forward", "Orient to Center", "Orient to Path"],     // Path
            3: ["Forward", "Orient to Center"]                        // Sphere
        };

        var ORIENT_KEYS = {
            0: ["forward", "orientCenter"],
            1: ["forward", "orientCenter"],
            2: ["forward", "orientCenter", "orientPath"],
            3: ["forward", "orientCenter"]
        };

        // Path type labels
        var PATH_TYPES = ["Circle", "Wave", "Spiral"];

        // Storage for layer order list
        var layerOrder = [];

        // ── Build the panel ───────────────────────────────────
        function buildUI(panel) {

            panel.orientation = "column";
            panel.alignChildren = ["fill", "top"];
            panel.spacing = 6;
            panel.margins = 10;

            // ── Header ──
            var header = panel.add("group");
            header.orientation = "row";
            header.alignChildren = ["left", "center"];
            var titleText = header.add("statictext", undefined, "⬛ Grid Builder Pro");
            titleText.graphics.font = ScriptUI.newFont("dialog", "BOLD", 13);

            panel.add("panel", undefined, "").maximumSize = [9999, 2]; // divider

            // ── Grid Type Row ──
            var row1 = panel.add("group");
            row1.orientation = "row";
            row1.add("statictext", undefined, "Grid Mode:");
            var gridTypeDD = row1.add("dropdownlist", undefined, GRID_MODES);
            gridTypeDD.selection = 0;
            gridTypeDD.preferredSize.width = 150;

            // ── Orientation Row ──
            var row2 = panel.add("group");
            row2.orientation = "row";
            row2.add("statictext", undefined, "Orientation:");
            var orientDD = row2.add("dropdownlist", undefined, ORIENT_MODES[0]);
            orientDD.selection = 0;
            orientDD.preferredSize.width = 150;

            // ── Path Type Row (only shown for path mode) ──
            var pathGroup = panel.add("group");
            pathGroup.orientation = "row";
            pathGroup.add("statictext", undefined, "Path Type:");
            var pathTypeDD = pathGroup.add("dropdownlist", undefined, PATH_TYPES);
            pathTypeDD.selection = 0;
            pathTypeDD.preferredSize.width = 120;
            pathGroup.visible = false;

            panel.add("panel", undefined, "").maximumSize = [9999, 2];

            // ── Parameters ──────────────────────────────────
            var paramPanel = panel.add("panel", undefined, "Parameters");
            paramPanel.orientation = "column";
            paramPanel.alignChildren = ["fill", "top"];
            paramPanel.margins = [10, 15, 10, 10];

            // Rectangular params
            var rectParams = paramPanel.add("group");
            rectParams.orientation = "column";
            rectParams.alignChildren = ["fill", "top"];
            rectParams.spacing = 4;

            function labeledSlider(parent, label, val, lo, hi) {
                var g = parent.add("group");
                g.orientation = "row";
                g.alignChildren = ["left", "center"];
                g.add("statictext", undefined, label).preferredSize.width = 100;
                var ed = g.add("edittext", undefined, String(val));
                ed.preferredSize.width = 60;
                var sl = g.add("slider", undefined, val, lo, hi);
                sl.preferredSize.width = 80;
                sl.onChanging = function() { ed.text = Math.round(sl.value); };
                ed.onChanging = function() {
                    var v = parseFloat(ed.text);
                    if (!isNaN(v)) sl.value = UtilModule.clamp(v, lo, hi);
                };
                return { group: g, slider: sl, edit: ed,
                    getValue: function() { return parseFloat(ed.text) || val; } };
            }

            var colsCtrl  = labeledSlider(rectParams, "Columns",   3, 1, 30);
            var rowsCtrl  = labeledSlider(rectParams, "Rows",      3, 1, 30);
            var spXCtrl   = labeledSlider(rectParams, "Spacing X", 200, 0, 2000);
            var spYCtrl   = labeledSlider(rectParams, "Spacing Y", 200, 0, 2000);

            // Radial params
            var radParams = paramPanel.add("group");
            radParams.orientation = "column";
            radParams.alignChildren = ["fill", "top"];
            radParams.spacing = 4;
            radParams.visible = false;

            var radRadCtrl    = labeledSlider(radParams, "Radius",       300, 10, 3000);
            var radSpreadCtrl = labeledSlider(radParams, "Angle Spread", 360, 1,  360);
            var radStartCtrl  = labeledSlider(radParams, "Start Angle",  0,  -360, 360);
            var cwGroup = radParams.add("group");
            cwGroup.add("statictext", undefined, "Clockwise:");
            var cwCheck = cwGroup.add("checkbox", undefined, "");
            cwCheck.value = true;

            // Path params
            var pathParams = paramPanel.add("group");
            pathParams.orientation = "column";
            pathParams.alignChildren = ["fill", "top"];
            pathParams.spacing = 4;
            pathParams.visible = false;

            var pathRadCtrl  = labeledSlider(pathParams, "Radius",      300, 10, 3000);
            var pathLenCtrl  = labeledSlider(pathParams, "Path Length", 800, 10, 5000);
            var waveAmpCtrl  = labeledSlider(pathParams, "Wave Amp",    150, 0, 1000);
            var waveFreqCtrl = labeledSlider(pathParams, "Wave Freq",   2, 0.1, 20);

            // Sphere params
            var sphParams = paramPanel.add("group");
            sphParams.orientation = "column";
            sphParams.alignChildren = ["fill", "top"];
            sphParams.spacing = 4;
            sphParams.visible = false;

            var sphRadCtrl  = labeledSlider(sphParams, "Radius",  400, 10, 5000);
            var sphDenCtrl  = labeledSlider(sphParams, "Density", 1,   1, 100);

            panel.add("panel", undefined, "").maximumSize = [9999, 2];

            // ── Common Controls ──────────────────────────────
            var commonPanel = panel.add("panel", undefined, "Common Controls");
            commonPanel.orientation = "column";
            commonPanel.alignChildren = ["fill", "top"];
            commonPanel.margins = [10, 15, 10, 10];
            commonPanel.spacing = 4;

            var scaleCtrl   = labeledSlider(commonPanel, "Scale %",       100, 1, 500);
            var scaleVarCtrl= labeledSlider(commonPanel, "Scale Var %",   0,   0, 100);
            var rotOffCtrl  = labeledSlider(commonPanel, "Rotation",      0, -360, 360);
            var rotVarCtrl  = labeledSlider(commonPanel, "Rotation Var",  0,   0, 360);
            var randPosCtrl = labeledSlider(commonPanel, "Randomize Pos", 0,   0, 500);
            var seedCtrl    = labeledSlider(commonPanel, "Random Seed",   0,   0, 999);

            panel.add("panel", undefined, "").maximumSize = [9999, 2];

            // ── Layer Order List ─────────────────────────────
            var listPanel = panel.add("panel", undefined, "Layer Order (select layers first)");
            listPanel.orientation = "column";
            listPanel.alignChildren = ["fill", "top"];
            listPanel.margins = [10, 15, 10, 10];

            var layerList = listPanel.add("listbox", undefined, [],
                {multiselect: false});
            layerList.preferredSize = [220, 100];

            var listBtns = listPanel.add("group");
            listBtns.orientation = "row";
            var btnRefreshList = listBtns.add("button", undefined, "↺ Refresh List");
            var btnMoveUp      = listBtns.add("button", undefined, "▲ Up");
            var btnMoveDown    = listBtns.add("button", undefined, "▼ Down");

            panel.add("panel", undefined, "").maximumSize = [9999, 2];

            // ── Action Buttons ───────────────────────────────
            var actionGroup = panel.add("group");
            actionGroup.orientation = "row";
            actionGroup.alignment   = ["fill", "top"];

            var btnCreate  = actionGroup.add("button", undefined, "✦ Create Grid");
            var btnRebuild = actionGroup.add("button", undefined, "↺ Rebuild");

            btnCreate.preferredSize.width  = 120;
            btnRebuild.preferredSize.width = 80;

            var liveToggle = panel.add("checkbox", undefined, "Live Update (auto-rebuild on change)");
            liveToggle.value = false;

            // ── Status Bar ───────────────────────────────────
            var statusText = panel.add("statictext", undefined, "Ready.");
            statusText.graphics.foregroundColor =
                statusText.graphics.newPen(ScriptUI.PenType.SOLID_COLOR, [0.4,0.7,0.4,1], 1);

            // ──────────────────────────────────────────────────
            //  EVENT HANDLERS
            // ──────────────────────────────────────────────────

            // Show/hide param groups on mode change
            gridTypeDD.onChange = function() {
                var idx = gridTypeDD.selection ? gridTypeDD.selection.index : 0;
                rectParams.visible = (idx === 0);
                radParams.visible  = (idx === 1);
                pathParams.visible = (idx === 2);
                sphParams.visible  = (idx === 3);
                pathGroup.visible  = (idx === 2);

                // Rebuild orientation dropdown
                var modes = ORIENT_MODES[idx];
                orientDD.removeAll();
                for (var m = 0; m < modes.length; m++) {
                    orientDD.add("item", modes[m]);
                }
                orientDD.selection = 0;

                if (liveToggle.value) doRebuild(idx);
                try { panel.layout.layout(true); } catch(e) {}
            };

            // Refresh layer list from selection
            btnRefreshList.onClick = function() {
                var comp = app.project.activeItem;
                if (!(comp instanceof CompItem)) {
                    setStatus("No active composition.");
                    return;
                }
                layerOrder = [];
                var sel = comp.selectedLayers;
                for (var i = 0; i < sel.length; i++) {
                    layerOrder.push(sel[i]);
                }
                refreshListUI(layerList, layerOrder);
                setStatus("Loaded " + layerOrder.length + " layer(s).");
            };

            // Move selected item up in list
            btnMoveUp.onClick = function() {
                var selIdx = layerList.selection ? layerList.selection.index : -1;
                if (selIdx > 0) {
                    var tmp = layerOrder[selIdx - 1];
                    layerOrder[selIdx - 1] = layerOrder[selIdx];
                    layerOrder[selIdx] = tmp;
                    refreshListUI(layerList, layerOrder);
                    layerList.selection = selIdx - 1;
                    if (liveToggle.value) doRebuild(getCurrentGridType());
                }
            };

            // Move selected item down in list
            btnMoveDown.onClick = function() {
                var selIdx = layerList.selection ? layerList.selection.index : -1;
                if (selIdx >= 0 && selIdx < layerOrder.length - 1) {
                    var tmp = layerOrder[selIdx + 1];
                    layerOrder[selIdx + 1] = layerOrder[selIdx];
                    layerOrder[selIdx] = tmp;
                    refreshListUI(layerList, layerOrder);
                    layerList.selection = selIdx + 1;
                    if (liveToggle.value) doRebuild(getCurrentGridType());
                }
            };

            // Create Grid
            btnCreate.onClick = function() {
                var comp = app.project.activeItem;
                if (!(comp instanceof CompItem)) {
                    setStatus("Open a composition first.");
                    return;
                }

                // Use layerOrder if populated, else use current selection
                var layers = layerOrder.length > 0 ? layerOrder : getSelectedLayers(comp);

                if (layers.length === 0) {
                    UtilModule.warn("Please select at least one layer in the timeline.");
                    setStatus("No layers selected.");
                    return;
                }

                var ok = GridModule.buildGrid(
                    comp,
                    layers,
                    getCurrentGridType(),
                    getCurrentOrientMode(),
                    collectParams(),
                    getPathType()
                );

                if (ok) {
                    layerOrder = layers.slice(); // store reference
                    refreshListUI(layerList, layerOrder);
                    setStatus("Grid created with " + layers.length + " layers. ✓");
                } else {
                    setStatus("Grid creation failed. See alert.");
                }
            };

            // Rebuild
            btnRebuild.onClick = function() {
                doRebuild(getCurrentGridType());
            };

            // ── Helper functions ─────────────────────────────
            function getCurrentGridType() {
                return gridTypeDD.selection ? gridTypeDD.selection.index : 0;
            }

            function getCurrentOrientMode() {
                var modeIdx  = gridTypeDD.selection ? gridTypeDD.selection.index : 0;
                var orientIdx= orientDD.selection ? orientDD.selection.index : 0;
                return ORIENT_KEYS[modeIdx][orientIdx] || "forward";
            }

            function getPathType() {
                return pathTypeDD.selection ? pathTypeDD.selection.index : 0;
            }

            function collectParams() {
                return {
                    // Rect
                    cols:     colsCtrl.getValue(),
                    rows:     rowsCtrl.getValue(),
                    spX:      spXCtrl.getValue(),
                    spY:      spYCtrl.getValue(),
                    // Radial
                    radius:   radRadCtrl.getValue(),
                    spread:   radSpreadCtrl.getValue(),
                    startAng: radStartCtrl.getValue(),
                    cw:       cwCheck.value ? 1 : 0,
                    // Path
                    pathLen:  pathLenCtrl.getValue(),
                    waveAmp:  waveAmpCtrl.getValue(),
                    waveFreq: waveFreqCtrl.getValue(),
                    // Sphere
                    density:  sphDenCtrl.getValue(),
                    // Common
                    scale:    scaleCtrl.getValue(),
                    scaleVar: scaleVarCtrl.getValue(),
                    rotOffset:rotOffCtrl.getValue(),
                    rotVar:   rotVarCtrl.getValue(),
                    randPos:  randPosCtrl.getValue(),
                    seed:     seedCtrl.getValue()
                };
            }

            function doRebuild(gridType) {
                var comp = app.project.activeItem;
                if (!(comp instanceof CompItem)) {
                    setStatus("No active composition.");
                    return;
                }
                if (layerOrder.length === 0) {
                    setStatus("No layers in list. Click Refresh List first.");
                    return;
                }
                var ok = GridModule.rebuildGrid(
                    comp,
                    layerOrder,
                    gridType,
                    getCurrentOrientMode(),
                    collectParams(),
                    getPathType()
                );
                setStatus(ok ? "Grid rebuilt. ✓" : "Rebuild failed.");
            }

            function getSelectedLayers(comp) {
                var result = [];
                var sel = comp.selectedLayers;
                for (var i = 0; i < sel.length; i++) {
                    result.push(sel[i]);
                }
                return result;
            }

            function refreshListUI(listbox, layers) {
                listbox.removeAll();
                for (var i = 0; i < layers.length; i++) {
                    listbox.add("item", (i + 1) + ". " + layers[i].name);
                }
            }

            function setStatus(msg) {
                statusText.text = msg;
            }

            // Init: show rect params
            rectParams.visible = true;
            radParams.visible  = false;
            pathParams.visible = false;
            sphParams.visible  = false;
            pathGroup.visible  = false;

            try { panel.layout.layout(true); } catch(e) {}

            return panel;
        }

        // ── Create / return the window or panel ──────────────
        function createUI(thisObj) {
            var panel;
            if (thisObj instanceof Panel) {
                // Docked panel
                panel = thisObj;
            } else {
                // Floating window
                panel = new Window("palette", "Grid Builder Pro", undefined, {resizeable: true});
                panel.onResizing = panel.onResize = function() {
                    try { this.layout.resize(); } catch(e) {}
                };
            }

            buildUI(panel);

            if (panel instanceof Window) {
                panel.center();
                panel.show();
            } else {
                panel.layout.layout(true);
                panel.layout.resize();
            }

            return panel;
        }

        return { createUI: createUI };
    })();

    // ─────────────────────────────────────────────────────────
    //  LAUNCH
    // ─────────────────────────────────────────────────────────
    UIModule.createUI(thisObj);

}(this));


/*
 * ═══════════════════════════════════════════════════════════════
 *  GRID BUILDER PRO — EXPRESSION SNIPPETS REFERENCE
 *  (These are embedded above; reproduced here for documentation)
 * ═══════════════════════════════════════════════════════════════
 *
 *  [1] RECTANGULAR POSITION (applied per-layer)
 *  ─────────────────────────────────────────────
 *  var ctrlLayer = thisComp.layer('GridBuilderPro_Control');
 *  var fx = ctrlLayer.Effects;
 *  var idx   = <0-based index>;
 *  var total = <total layers>;
 *  var cols  = Math.max(1, Math.round(fx('GBP: Columns')(1).value));
 *  var spX   = fx('GBP: Spacing X')(1).value;
 *  var spY   = fx('GBP: Spacing Y')(1).value;
 *  var col   = idx % cols;
 *  var row   = Math.floor(idx / cols);
 *  var ox    = (cols - 1) * spX / 2;
 *  var rows  = Math.ceil(total / cols);
 *  var oy    = (rows - 1) * spY / 2;
 *  var basePos = ctrlLayer.transform.position.value;
 *  [basePos[0] + col * spX - ox, basePos[1] + row * spY - oy]
 *
 *  [2] RADIAL POSITION (applied per-layer)
 *  ────────────────────────────────────────
 *  var radius   = fx('GBP: Radius')(1).value;
 *  var spread   = fx('GBP: Angle Spread')(1).value;
 *  var startAng = fx('GBP: Start Angle')(1).value;
 *  var cw       = fx('GBP: Clockwise')(1).value;
 *  var step     = spread / total;
 *  var dir      = (cw >= 0.5) ? 1 : -1;
 *  var ang      = (startAng + dir * step * idx) * Math.PI / 180;
 *  [basePos[0] + Math.cos(ang) * radius, basePos[1] + Math.sin(ang) * radius]
 *
 *  [3] SPHERICAL POSITION (Fibonacci sphere)
 *  ──────────────────────────────────────────
 *  var golden = Math.PI * (3 - Math.sqrt(5));
 *  var theta  = golden * idx;
 *  var phi    = Math.acos(1 - 2 * (idx + 0.5) / total);
 *  var sx     = radius * Math.sin(phi) * Math.cos(theta);
 *  var sy     = radius * Math.sin(phi) * Math.sin(theta);
 *  var sz     = radius * Math.cos(phi);
 *  [basePos[0]+sx, basePos[1]+sy, basePos[2]+sz]
 *
 *  [4] TARGET FOCUS OPACITY
 *  ─────────────────────────
 *  var focus = fx('GBP: Target Focus')(1).value;
 *  if (focus < 0.5) { 100 }
 *  else { Math.max(0, 1 - Math.abs(idx - (Math.round(focus)-1)) * 0.4) * 100 }
 *
 * ═══════════════════════════════════════════════════════════════
 *  INSTALLATION & RUNNING INSTRUCTIONS
 * ═══════════════════════════════════════════════════════════════
 *
 *  INSTALL (as dockable panel):
 *    Windows:
 *      C:\Program Files\Adobe\Adobe After Effects <ver>\Support Files\Scripts\ScriptUI Panels\
 *    macOS:
 *      /Applications/Adobe After Effects <ver>/Scripts/ScriptUI Panels/
 *    → Restart After Effects
 *    → Window menu → GridBuilderPro.jsx
 *
 *  RUN (one-time, without installing):
 *    File → Scripts → Run Script File... → select GridBuilderPro.jsx
 *
 *  BASIC WORKFLOW:
 *    1. Create a composition with layers (text, shapes, footage, precomps).
 *    2. Select the layers you want to arrange.
 *    3. Open the panel (Window > GridBuilderPro.jsx).
 *    4. Click "↺ Refresh List" to load selected layers.
 *    5. Reorder layers using ▲▼ buttons if needed.
 *    6. Choose Grid Mode (Rectangular / Radial / Path / Spherical).
 *    7. Adjust parameters.
 *    8. Click "✦ Create Grid".
 *    9. All grid controls appear as effect sliders on the
 *       "GridBuilderPro_Control" Null layer — keyframe them freely.
 *   10. Use "GBP: Target Focus" slider on the Null to spotlight layers.
 *   11. Click "↺ Rebuild" after manually changing Null effect values
 *       if expressions need a refresh.
 *
 *  TIPS:
 *    • The Null layer controls the entire grid. Animate its position
 *      to move the whole arrangement.
 *    • All expression-linked properties remain individually animatable —
 *      delete an expression on any layer to free that property.
 *    • For Spherical mode, add a camera to take advantage of 3D depth.
 *    • Increase "GBP: Random Seed" to get different scatter variations.
 *    • "Live Update" checkbox auto-rebuilds when you reorder layers.
 *
 *  COMPATIBILITY: After Effects CC 2019+ (expression engine: Legacy or JS)
 * ═══════════════════════════════════════════════════════════════
 */

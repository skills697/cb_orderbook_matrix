import { CENV } from './cenv.js';
import { snTime } from './snTime.js';

/**
 * Global UI Elements
 * @namespace mainUI
 * @type {{ layers: { selected: string; }; selectMesh: {}; highlightLayer: any; hover: { light: any; line: any; point: any; elem: { time: any; price: any; val: any; }; }; lineSelect: number; hoverDisplay: boolean; candleDisplay: boolean; orderDisplay: boolean; dollarFormat: any; }}
 */
var mainUI = { 
    layers: {
        selected: "0"
    },
    selectMesh: [],
    highlightLayer: null,
    hover: {
        light: null,
        line: null,
        point: null,
        elem: {
            time: null,
            price: null,
            val: null,
        },
    },
    lineSelect: -1,
    hoverDisplay: false,
    candleDisplay: false,
    orderDisplay: false,
    dollarFormat: null,
};

/**
 * Global 3D Geometry Vars
 * @namespace main3D
 * @type {{ engine: BABYLON.Engine; texture: any; selectUI: any; meshes: [BABYLON.Mesh]; isMeshHover: boolean; floor: { lines: { prices: {}; frames: {}; }; }; }}
 */
var main3D = {
    scene: null,
    camera: null,
    engine: null,
    texture: null,
    selectUI: null,
    meshes: [],
    isMeshHover: false,
    floor: {
        lines: {
            prices: [],
            frames: [],
        },
    },
};

/**
 * @namespace anim
 * @type {{ playing: boolean; transformZ: any; snTimeLeft: any; snTimeRight: any; snTimeSvg: any; snTimeDragging: boolean; snTimeSelect: boolean; setTimePosition: (inputPos: any) => any; }}
 */
var anim = {
    playing: false,
    transformZ: null,
};

/**
 * @namespace mapData
 * @type {{ maxBuy: number; startTime: number; endTime: number; snapshots: {}; snapsTotal: number; }}
 */
var mapData = {
    maxBuy: 0,
    startTime: 0,
    endTime: 0,
    snapshots: {},
    snapsTotal: 0,
};

/**
* @description Retrieve order book snapshot data from server for buys and sells
*/
var prepareData = async () => {
    console.log("Preparing Data");
    try {
        //Latest Snapshot
        const res1 = await fetch('/snapshots/latest');
        const latest = await res1.json();
        console.log("Latest Found!");
        console.log(latest);
    
        //Snapshots
        mapData.endTime = latest[0].unix_ts_start - 300;
        mapData.startTime = latest[0].unix_ts_start - (300 * 51);
        const res2 = await fetch('/snapshots?startTime=' + mapData.startTime + "&endTime=" + mapData.endTime);
        const res_snaps = await res2.json();
        if(res_snaps.length > 0){
            res_snaps.forEach((val) => {
                mapData.snapshots[val.unix_ts_start] = {
                    id: val.unix_ts_start,
                    data: val
                };
            });
        }
        console.log("Snapshots Found!");

        //Orders
        const res3 = await fetch('/orders?startTime=' + mapData.startTime + "&endTime=" + mapData.endTime);
        const order_snaps = await res3.json();
        for (const order_id in order_snaps) {
            if(!(order_snaps[order_id].snapshot in mapData.snapshots)) {
                throw new Error("Order found for a missing snapshot: " + order_snaps[order_id].snapshot);
            }
            if(!("orders" in mapData.snapshots[order_snaps[order_id].snapshot])) {
                mapData.snapshots[order_snaps[order_id].snapshot].orders = {
                    buys: [],
                    sells: [] 
                }
            }
            order_snaps[order_id].orders.forEach((n_order, n_index) => {
                if(n_order.side == 'buy') {
                    mapData.snapshots[order_snaps[order_id].snapshot].orders.buys.push(n_order);
                } else if((128 - n_index) < 100) {
                    // Currently Capturing only the lowest 100 sell groups, but could be later expanded to flexibly select more/less
                    mapData.snapshots[order_snaps[order_id].snapshot].orders.sells.unshift(n_order);
                }
            });
        };
        console.log("Orders Found!");
        
        //Candles
        const res4 = await fetch('/candles?startTime=' + mapData.startTime + "&endTime=" + mapData.endTime);
        const cand = await res4.json();
        cand.forEach((val) => {
            if(!(val.start in mapData.snapshots)) {
                mapData.snapshots[val.start] = { id: val.start, candle: val };
            } else {
                mapData.snapshots[val.start].candle = val;
            }
            if(mapData.maxBuy < val.high){
                mapData.maxBuy = val.high;
            } 
        });
        console.log("Candles Found!");

        mapData.snapsTotal = Object.keys(mapData.snapshots).length;
        console.log("Creating Scene");
        createScene();
        
    } catch(error) {
        console.error("Error:", error);
    }
}


/**
* @description Pre-data import, scene generation
* @param {BABYLON.Engine} main_engine - the main babylon engine
* @param {HTMLCanvasElement} main_canvas - the canvas element
*/
var initScene = function (main_engine, main_canvas) {
    console.log("Initializing Scene");
    main3D.engine = main_engine;
    main3D.scene = new BABYLON.Scene(main3D.engine);
    mainUI.dollarFormat = new Intl.NumberFormat( "en-US", {style: "currency", currency: "USD", minimumFractionDigits: 2});

    main3D.texture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("GUI", true, main3D.scene);    
    main3D.camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0.5 * CENV.MAP_RESOLUTION, 30, 0), main3D.scene);
    main3D.camera.inputs.addMouseWheel();
    main3D.camera.setTarget(new BABYLON.Vector3(0.5 * CENV.MAP_RESOLUTION, 25, CENV.DISPLAY_DEPTH * CENV.FRAME_RATE));
    main3D.camera.attachControl(main_canvas, true);

    var hlight1 = new BABYLON.HemisphericLight("HemisphericLight1", new BABYLON.Vector3(1, 1, 0));
    hlight1.diffuse = new BABYLON.Color3(0.63, 0.86, 0.97);
    hlight1.specular = new BABYLON.Color3(0.37, 0.59, 0.65);
    hlight1.intensity = 0.65;

    var dlight1 = new BABYLON.DirectionalLight("DirectionalLight1", new BABYLON.Vector3(-0.15, -1, -0.2), main3D.scene);
    dlight1.diffuse = new BABYLON.Color3(0.97, 0.78, 0.36);
    dlight1.specular = new BABYLON.Color3(1, 0.89, 0.57);
    dlight1.intensity = 0.35;

    main3D.scene.clearColor = new BABYLON.Color3(0.07, 0.07, 0.11, 0.9);
    anim.transformZ = new BABYLON.TransformNode("root");

    mainUI.highlightLayer = new BABYLON.HighlightLayer("hl1", main3D.scene);

    main3D.scene.registerBeforeRender(renderScene);
}


/**
* @description Render the scene
*/
const renderScene = function () {
    if(mainUI.hover.light != null && mainUI.hover.light.isEnabled() != mainUI.isMeshHover) {
        mainUI.hover.light.setEnabled(mainUI.isMeshHover);
    }
    if(mainUI.hover.line != null && mainUI.hover.line.isEnabled() != mainUI.isMeshHover) {
        mainUI.hover.line.setEnabled(mainUI.isMeshHover);
    }

    if(mainUI.lineSelect >= 0) {
        if(main3D.meshes[mainUI.layers.selected].buys[mainUI.lineSelect][1].alpha == 0.0
                && mainUI.highlightLayer.isEnabled) {
            mainUI.highlightLayer.isEnabled = false;
        } else if(main3D.meshes[mainUI.layers.selected].buys[mainUI.lineSelect][1].alpha > 0.0
                && !mainUI.highlightLayer.isEnabled) {
            mainUI.highlightLayer.isEnabled = true;
        }
    }

    if(anim.playing){
        /* ANIMATION UPDATE */
        setTimePosition((anim.transformZ.position.z - 0.1) * -1);
    }
}

/**
* @description Post-data import, scene generation
*/
const createScene = function () {
    //Initialize Meshes for selected layer
    createLayer(mainUI.layers.selected);

    mainUI.hover.light = new BABYLON.PointLight("light", new BABYLON.Vector3(0, 0, 0), main3D.scene);
    mainUI.hover.light.diffuse = new BABYLON.Color3(1, 0.9, 0.65);
    mainUI.hover.light.specular = new BABYLON.Color3(1, 0.9, 0.65);
    mainUI.hover.light.range = 5;
    mainUI.hover.light.setEnabled(false);

    mainUI.hover.line = BABYLON.MeshBuilder.CreateLines("meshHoverLine", { 
        points: [new BABYLON.Vector3(0,0,0), new BABYLON.Vector3(1,1,1)],
        updatable: true,
    });
    mainUI.hover.line.color = new BABYLON.Color4(1, 0.85, 0.21, 1);
    mainUI.hover.line.renderingGroupId = 1;
    mainUI.hover.line.alwaysSelectAsActiveMesh = true;
    mainUI.hover.line.setEnabled(false);

    // mainUI.hover.point = BABYLON.MeshBuilder.CreateSphere("meshHoverPoint", {
    //     diameter: 0.5, 
    // });  
    // mainUI.hover.point.position.y -= 1;   
    // let hoverMat = new BABYLON.StandardMaterial("meshHoverPointMat", mainScene);
    // hoverMat.diffuseColor = new BABYLON.Color3(1, 0.85, 0.21);
    // hoverMat.ambientColor = new BABYLON.Color3(1, 0.85, 0.21);
    // hoverMat.specularColor = new BABYLON.Color3(1, 0.95, 0.65);
    // mainUI.hover.point.material = hoverMat;
    // mainUI.hover.point.parent = mainUI.hover.light;
    
    initFloor();
    updateAlphaTrans();
    snTime.initTimeGfx(mapData.snapshots);

    main3D.scene.onPointerMove = function (event, pickResult) {
        if (mainUI.isMeshHover) {
            mainUI.hover.light.position = new BABYLON.Vector3(pickResult.pickedPoint.x, pickResult.pickedPoint.y+1, pickResult.pickedPoint.z);
            //Add the display price data on hover here
            mainUI.hover.line = BABYLON.MeshBuilder.CreateLines(null, {
                points: [
                    new BABYLON.Vector3(pickResult.pickedPoint.x,0,pickResult.pickedPoint.z), 
                    new BABYLON.Vector3(pickResult.pickedPoint.x,pickResult.pickedPoint.y,pickResult.pickedPoint.z)
                ], 
                instance: mainUI.hover.line 
            });
            updateHoverPanel(pickResult.pickedPoint.x,pickResult.pickedPoint.y,pickResult.pickedPoint.z);
            showHoverPanel();
        } else {
            hideHoverPanel();
        }
    }

    main3D.scene.onPointerDown = (event, pickResult) => {
        if(event.button == 0){
            if(mainUI.lineSelect >= 0) {
                mainUI.highlightLayer.removeMesh(main3D.meshes[mainUI.layers.selected].buys[mainUI.lineSelect][1]);
                mainUI.highlightLayer.removeMesh(main3D.meshes[mainUI.layers.selected].sells[mainUI.lineSelect][1]);
                snTime.setSelectedLine(-1, mapData.snapsTotal);
                hideOrdersTable();
                hideCandlePanel();
            }

            if(mainUI.isMeshHover) {
                const line_num = Math.round((pickResult.pickedPoint.z - anim.transformZ.position.z - 10.0)/10.0);
                mainUI.lineSelect = line_num;
                snTime.setSelectedLine(lineNum, mapData.snapsTotal);
                const sel_snap_num = main3D.meshes[mainUI.layers.selected].buys[line_num][1].metadata.id
                const sel_snapshot = mapData.snapshots[sel_snap_num];
                mainUI.highlightLayer.addMesh(main3D.meshes[mainUI.layers.selected].buys[line_num][1], BABYLON.Color3.Red());
                mainUI.highlightLayer.addMesh(main3D.meshes[mainUI.layers.selected].sells[line_num][1], BABYLON.Color3.Red());
                showOrdersTable();
                showCandlePanel();
                setSelectedOrders(sel_snapshot);
                setSelectedCandle(sel_snapshot);
            } 
        }
    };
}

/**
* @description Creates new geometry for a given layer
* @param {number} layer_index - index of layer to create
*/
const createLayer = function(layer_index) {
    // TransformZ[row] -> TransformY -> Mesh
    main3D.meshes[layer_index] = {};
    main3D.meshes[layer_index].transformY = new BABYLON.TransformNode("transY" + layer_index);
    main3D.meshes[layer_index].transformY.parent = anim.transformZ;
    main3D.meshes[layer_index].buys = [];
    main3D.meshes[layer_index].sells = [];

    for(const snap_id in mapData.snapshots){
        //TODO: remove last snapshot from generating a new geometry/row
        //Do not generate a new mesh if we have no order history (just a candlestick)
        if(!mapData.snapshots[snap_id].orders) return;

        //build buy meshes
        const buy_mesh = generateMapRow(mapData.snapshots[snap_id], true);
        buy_mesh.mesh.parent = main3D.meshes[layer_index].transformY;
        buy_mesh.line.parent = main3D.meshes[layer_index].transformY;
        main3D.meshes[layer_index].buys.push([buy_mesh.mesh, buy_mesh.line]);

        //build sell meshes
        const sell_mesh = generateMapRow(mapData.snapshots[snap_id], false);
        sell_mesh.mesh.parent = main3D.meshes[layer_index].transformY;
        sell_mesh.line.parent = main3D.meshes[layer_index].transformY;
        main3D.meshes[layer_index].sells.push([sell_mesh.mesh, sell_mesh.line]);
    };

    // add selected line to highlight layer
    if(mainUI.lineSelect >= 0) {
        mainUI.highlightLayer.addMesh(main3D.meshes[layer_index].buys[mainUI.lineSelect][1], BABYLON.Color3.Red());
        mainUI.highlightLayer.addMesh(main3D.meshes[layer_index].sells[mainUI.lineSelect][1], BABYLON.Color3.Red());
    }
}

/**
* @description disables the existing geometry for this layer
* @param {number} layer_index - index of layer to create
*/
const hideLayer = function(layer_index) {
    main3D.meshes[layer_index].buys.forEach((val, index) => {
        val[0].setEnabled(false);
        val[1].setEnabled(false);
    });
    main3D.meshes[layer_index].sells.forEach((val, index) => {
        val[0].setEnabled(false);
        val[1].setEnabled(false);
    });
    
    // remove selected line from highlight layer
    if(mainUI.lineSelect >= 0) {
        mainUI.highlightLayer.removeMesh(main3D.meshes[layer_index].buys[mainUI.lineSelect][1]);
        mainUI.highlightLayer.removeMesh(main3D.meshes[layer_index].sells[mainUI.lineSelect][1]);
    }
}

/**
* @description enables the existing geometry for this layer
* @param {number} layer_index - index of layer to create
*/
const showLayer = function(layer_index) {
    main3D.meshes[layer_index].buys.forEach((val) => {
        val[0].setEnabled(true);
        val[1].setEnabled(true);
    });
    main3D.meshes[layer_index].sells.forEach((val) => {
        val[0].setEnabled(true);
        val[1].setEnabled(true);
    });

    // add selected line to highlight layer
    if(mainUI.lineSelect >= 0) {
        mainUI.highlightLayer.addMesh(main3D.meshes[layer_index].buys[mainUI.lineSelect][1], BABYLON.Color3.Red());
        mainUI.highlightLayer.addMesh(main3D.meshes[layer_index].sells[mainUI.lineSelect][1], BABYLON.Color3.Red());
    }
}

/**
* @description create a new row for our price map
* @param {Snapshot} snapshot - snapshot object for row to create
* @param {boolean} ind_buy - indicates whether this is a buy or sell row
* @returns {object} - object containing the row mesh and line mesh
*/
const generateMapRow = function(snapshot, ind_buy) {
    const order_type = (ind_buy) ? "buys" : "sells";
    const uniq_name =  ((ind_buy) ? "Buy" : "Sell") + snapshot.id;

    // Select next order to map end points to for our new mesh
    const next_id = snapshot.id + CENV.TIME_GRANULARITY
    let next_orders = [];
    if(next_id in mapData.snapshots) {
        if("orders" in mapData.snapshots[next_id]) {
            next_orders = mapData.snapshots[next_id].orders[order_type];
        }
    }
    if(next_orders.length <= 0) {
        //no mesh found: generate a 0 trade value with same order prices
        snapshot.orders[order_type].forEach((val) => {
            next_orders.push({
                id: 0,
                max: val.max,
                min: val.min,
                side: val.side,
                total: 0
            });
        });
    }  

    // Generate mesh
    let geometry_data = [];
    const row_index = (snapshot.id - mapData.startTime) / CENV.TIME_GRANULARITY;
    geometry_data.push(getRowGeometry(snapshot.orders[order_type], row_index, ind_buy));
    geometry_data.push(getRowGeometry(next_orders, (row_index+1), ind_buy));
    let row = BABYLON.MeshBuilder.CreateRibbon("ribbon" + uniq_name, {
        pathArray: geometry_data, 
        closeArray: false, 
        closePath: false, 
        sideOrientation: (ind_buy) ? BABYLON.Mesh.FRONTSIDE : BABYLON.Mesh.BACKSIDE
        //sideOrientation: (ind_buy) ? BABYLON.Mesh.BACKSIDE : BABYLON.Mesh.FRONTSIDE
    });

    let white_mat = new BABYLON.StandardMaterial("rowMat" + uniq_name, main3D.scene);
    white_mat.wireframe = true;
    row.material = white_mat;
    row.renderingGroupId = 1;
    row.metadata = {id: snapshot.id}
    
    let mline1 = BABYLON.MeshBuilder.CreateLines("meshLine" + uniq_name, { points: geometry_data[0] });
    mline1.color = new BABYLON.Color4(1, 1, 1, 0);
    mline1.metadata = {id: snapshot.id}

    let mesh_action_manager = new BABYLON.ActionManager(main3D.scene);

    // Cursor over mesh
    mesh_action_manager.registerAction(
        new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOverTrigger, (event) => {
            //Skip if this mesh is not visible
            if(event.meshUnderPointer.material.alpha == 0.0) return;

            let select_ind = mainUI.selectMesh.indexOf(event.meshUnderPointer.name);
            if(select_ind == -1){
                mainUI.isMeshHover = true;
                //mainUI.highlightLayer.addMesh(event.meshUnderPointer, BABYLON.Color3.Green());
                mainUI.selectMesh.push(event.meshUnderPointer.name);
            }
        })
    );

    // Cursor out of mesh
    mesh_action_manager.registerAction(
        new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOutTrigger, (event) => {
            let select_ind = mainUI.selectMesh.indexOf(event.meshUnderPointer.name);
            if(select_ind > -1){
                mainUI.selectMesh.splice(select_ind, 1);
                //mainUI.highlightLayer.removeMesh(event.meshUnderPointer);
                mainUI.isMeshHover = (mainUI.selectMesh.length > 0) ? true : false;
            }
        })
    );

    row.actionManager = mesh_action_manager;

    return {
        mesh: row,
        line: mline1,
    };
}

/**
* @description Generates geometry data using the price data
* @param {Orders[]} orders - array of orders*
* @param {number} row_index - index of row to create
* @param {boolean} ind_buy - indicates whether this is a buy or sell row
*/
const getRowGeometry = function(orders, row_index, ind_buy){
    const optAdd = (mainUI.layers.selected == 0 || mainUI.layers.selected == 2) ? true : false;
    const optUsd = (mainUI.layers.selected == 2 || mainUI.layers.selected == 3) ? true : false;

    let resPath = [];
    let p1_y = 0;
    for(var i=0; i < orders.length; i++){
        const pr_val = (ind_buy) ? orders[i].max : orders[i].min;
        const tr_vol = orders[i].total;
        resPath.push(new BABYLON.Vector3(
            ((pr_val / mapData.maxBuy) * (CENV.MAP_RESOLUTION * 0.5)),// + (ind_buy ? -0.5 : 0.5),
            (p1_y = (optAdd ? p1_y : 0) + (tr_vol * ( optUsd ? (pr_val*0.0001) : 1 ) / 200)),
            (row_index * CENV.FRAME_RATE) + CENV.FRAME_RATE));
    }

    return resPath;
};

/**
* @description Generates geometry data for our 3D floor
*/
const initFloor = function(){
    // Get price scaling of floor lines
    let fl_scale = 0;
    const maxstr = mapData.maxBuy + "";
    if(mapData.maxBuy < 1 && maxstr.indexOf('.')){
        fl_scale = 1.0 / Math.pow(10, maxstr.substring(maxstr.indexOf('.') + 1).length - ((maxstr.substring(maxstr.indexOf('.') + 1) * 1) + "").length+1 );
    } else {
        fl_scale = Math.pow(10,  (maxstr.indexOf('.') > 0) ? maxstr.substring(0, maxstr.indexOf('.')).length - 1 : (maxstr.length - 1));
    }
    main3D.floor.count = 0;

    main3D.floor.createLine = (geometry) => {
        return BABYLON.MeshBuilder.CreateLines("floorLine" + (main3D.floor.count++), { points: geometry });
     };

    main3D.floor.createLineX = (x) => {
        const nline = [
            new BABYLON.Vector3(x, 0, 0),
            new BABYLON.Vector3(x, 0, (CENV.DISPLAY_DEPTH * CENV.FRAME_RATE))
        ];
        return main3D.floor.createLine(nline);
    };
    
    main3D.floor.createLineZ = (z) => {
        const nline = [
            new BABYLON.Vector3(0, 0, z),
            new BABYLON.Vector3(CENV.MAP_RESOLUTION, 0, z)
        ];
        return main3D.floor.createLine(nline);
    };

    for(let i=1; (fl_scale * (i/10)) < (mapData.maxBuy * 2); i++){
        //create price lines (x-axis)
        const xval = ((fl_scale * (i/10)) / (mapData.maxBuy * 2.0)) * CENV.MAP_RESOLUTION;
        const xline1 = main3D.floor.createLineX(xval);
        if(i%10 == 0){
            xline1.color = new BABYLON.Color4(0.3, 0.3, 1, 1);
            xline1.alpha = 0.5;
        } else if(i%5 == 0) {
            xline1.color = new BABYLON.Color4(0.25, 0.25, 0.65, 1);
            xline1.alpha = 0.4;
        } else {
            xline1.color = new BABYLON.Color4(0.15, 0.15, 0.4, 1);
            xline1.alpha = 0.4;
        }
        main3D.floor.lines.prices.push(xline1);
    }

    for(let i=0; i < mapData.snapsTotal; i++){
        //create frame lines (z-axis)
        const zval = i * CENV.FRAME_RATE;
        const zline1 = main3D.floor.createLineZ(zval);
        zline1.color = new BABYLON.Color4(0.25, 0.25, 0.65, 1);
        zline1.parent = main3D.meshes[mainUI.layers.selected].transformY;
        main3D.floor.lines.frames.push(zline1);
    }

};

/**
* @description Setup UI for controlling animations
*/
var setupAnimationEvents = function() {

    // Play Button setup
    mainUI.playButton = document.getElementById("anim-play");
    mainUI.playButton.onmousedown = function() {
        anim.playing = !anim.playing;
        mainUI.playButton.innerHtml = ((anim.playing) ? "Pause" : "Play" ) + " Animation"
    };

    // Watch for browser/canvas resize events
    window.addEventListener("resize", function () {
        main3D.engine.resize();
    });

    // selection changes to geometry data
    mainUI.layers = { 
        items: document.getElementsByClassName("bc-dval-opt"), 
        selected: 0 
    };
    selectGeometryEvent();

    main3D.scene.setRenderingAutoClearDepthStencil(1, false, false);

    // Register a render loop to repeatedly render the scene
    main3D.engine.runRenderLoop(function () {
            main3D.scene.render();
    });

    // snTime - animation control events
    const snSvgCont = document.getElementById('sn-time-gfx');
    snSvgCont.addEventListener('mousedown', (event) => {
        snTime.isDragging = true;
        const txOffset = event.offsetX - ((snTime.gfxSvg.clientWidth / mapData.snapsTotal) * CENV.DISPLAY_DEPTH / 2);
        const inputPos = (txOffset / snTime.gfxSvg.clientWidth) * (mapData.snapsTotal * CENV.FRAME_RATE);
        setTimePosition(inputPos);
    });

    snSvgCont.addEventListener('mousemove', (event) => {
        const txOffset = event.offsetX - ((snTime.gfxSvg.clientWidth / mapData.snapsTotal) * CENV.DISPLAY_DEPTH / 2);
        const inputPos = (txOffset / snTime.gfxSvg.clientWidth) * (mapData.snapsTotal * CENV.FRAME_RATE);
        if (snTime.isDragging) { 
            setTimePosition(inputPos);
        }
    });
    document.addEventListener('mouseup', (event) => {
        snTime.isDragging = false;
    });
}

/**
* @description updates the alpha transparency of meshes on render
*/
const updateAlphaTrans = function() {
    main3D.meshes[mainUI.layers.selected].buys.forEach(setAlphaTrans);
    main3D.meshes[mainUI.layers.selected].sells.forEach(setAlphaTrans);
    main3D.floor.lines.frames.forEach((val, index) => { val.alpha = 0.5 * getFrameAlpha(index) });
}

/**
* sets the alpha transparency of meshes on render
*  @param {mesh[]} alpha_val - object with alpha values, to set between 0 and 1
*  @param {number} index - index of mesh to set
*/
const setAlphaTrans = function(alpha_val, index) {
    const alphaOut = getFrameAlpha(index);

    alpha_val[0].material.alpha = ((alphaOut < 0.0) ? 0.0 : alphaOut) * CENV.MESH_ALPHA;
    alpha_val[1].alpha = ((alphaOut < 0.0) ? 0.0 : alphaOut) * CENV.LINE_ALPHA;
};

/**
* @description gets the alpha value for a given frame based on index value
*  @param {number} index - index of mesh to set
*/
const getFrameAlpha = function(index){
    const beginZ = CENV.DISPLAY_DEPTH * CENV.FRAME_RATE;
    const rp = (index * CENV.FRAME_RATE) + anim.transformZ.position.z;
    let alphaOut = 1.0;
    
    if(rp <= 0.0) 
        // z is negative - fade alpha out
        alphaOut = (10.0 - Math.abs(rp)) / 10.0;
    else if(rp > beginZ) 
        // z is positive - fade alpha in 
        alphaOut = (10.0 - (rp - beginZ)) / 10.0;

    return alphaOut;
};

/**
* @description setup a geometry click event
*/
const selectGeometryEvent = function() {
    if (mainUI.layers.items) {
        for (var i = 0; i < mainUI.layers.items.length; i++) {
            const item = mainUI.layers.items.item(i);
            item.setAttribute("selectval", i);
            if (item.classList.contains("bc-dval-opt-sel")){
                mainUI.layers.selected = i;
            }
            item.onclick = (event) => {
                console.log("layer select event");
                if (mainUI.layers.selected != event.target.getAttribute("selectval")) {
                    let prev_item = mainUI.layers.items.item(mainUI.layers.selected);
                    prev_item.classList.remove("bc-dval-opt-sel");
                    prev_item.classList.add("bc-dval-opt-x");
                    event.target.classList.add("bc-dval-opt-sel");
                    event.target.classList.remove("bc-dval-opt-x");
                    hideLayer(mainUI.layers.selected);

                    mainUI.layers.selected = event.target.getAttribute("selectval");
                    if (main3D.meshes[mainUI.layers.selected])
                        showLayer(mainUI.layers.selected);

                    else
                        createLayer(mainUI.layers.selected);

                    updateAlphaTrans();
                    updateTimeGfx();
                }
            };
        }
    }
    else {
        console.log("Error failed to find options for geometry layer values");
        console.log(mainUI.dval);
    }
}

/**
* @description gets the alpha value for a given frame based on index value
* @param {snapshot} snapshot - the snapshot object with orders to display
*/
const setSelectedOrders = function(snapshot){
    try{
        const buyTable = document.getElementById('orders-b-list');
        if(!buyTable) {
            throw new Error("Buys Table Not Found");
        }
        const newBuyTable = document.createElement('tbody');
        buyTable.parentNode.replaceChild(newBuyTable, buyTable);
        newBuyTable.id = 'orders-b-list';
        if (snapshot.orders.buys.length > 0) {
            snapshot.orders.buys.forEach((val) => {
                const row = newBuyTable.insertRow();
                const c1 = row.insertCell(0);
                c1.innerText = (Math.round(val.max * 100.0)/100.0).toFixed(2);
                c1.classList.add('orders-row');
                const c2 = row.insertCell(1);
                c2.innerText = Math.round(val.total * 100.0)/100.0;
                c2.classList.add('orders-row');
                const c3 = row.insertCell(2);
                c3.innerText = (Math.round(val.max * val.total * 100.0)/100.0).toFixed(2);
                c3.classList.add('orders-row');
            });
        }

        const sellTable = document.getElementById('orders-s-list');
        if(!sellTable) {
            throw new Error("Sells Table Not Found");
        }
        const newSellTable = document.createElement('tbody');
        sellTable.parentNode.replaceChild(newSellTable, sellTable);
        newSellTable.id = 'orders-s-list';
        if (snapshot.orders.sells.length > 0) {
            snapshot.orders.sells.slice().reverse().forEach((val) => {
                const row = newSellTable.insertRow();
                const c1 = row.insertCell(0);
                c1.innerText = (Math.round(val.min * 100.0)/100.0).toFixed(2);
                c1.classList.add('orders-row');
                const c2 = row.insertCell(1);
                c2.innerText = Math.round(val.total * 100.0)/100.0;
                c2.classList.add('orders-row');
                const c3 = row.insertCell(2);
                c3.innerText = (Math.round(val.min * val.total * 100.0)/100.0).toFixed(2);
                c3.classList.add('orders-row');
            });
        }
        newSellTable.scrollTop = newSellTable.scrollHeight;
    } catch(e){
        console.log("Error Loading Order Selection!");
        console.error(e);
    }
}

/**
* @description shows the UI orders container
*/
const showOrdersTable = function() {
    if(!mainUI.orderDisplay){
        const orderCont = document.getElementById('orders-panel');
        orderCont.style.display = "block";
        mainUI.orderDisplay = true;
    }
}

/**
* @description hides the UI orders container
*/
const hideOrdersTable = function() {
    if(mainUI.orderDisplay){
        const orderCont = document.getElementById('orders-panel');
        orderCont.style.display = "none";
        mainUI.orderDisplay = false;
    }
}

/**
* @description sets the data fields for the currently selected candle
* @param {snapshot} snapshot - the snapshot object with orders to display
*/
const setSelectedCandle = function(snapshot){
    const candle = snapshot.candle;
    const time_f = document.getElementById('candle-sel-time');
    const vol_f = document.getElementById('candle-sel-vol');
    const high_f = document.getElementById('candle-sel-high');
    const low_f = document.getElementById('candle-sel-low');
    const open_f = document.getElementById('candle-sel-open');
    const close_f = document.getElementById('candle-sel-close');

    if(!time_f || !vol_f || !high_f || !low_f || !open_f || !close_f){
        throw new Error("Candle Fields Not Found");
    }

    const timeDte = new Date((candle.start+300) * 1000);
    time_f.innerText = timeDte.toLocaleDateString("en-US") + " - " + timeDte.toLocaleTimeString("en-US");
    vol_f.innerText = (Math.round(candle.volume * 1000.0)/1000.0).toFixed(3);
    high_f.innerText = mainUI.dollarFormat.format(candle.high);
    low_f.innerText = mainUI.dollarFormat.format(candle.low);
    open_f.innerText = mainUI.dollarFormat.format(candle.open);
    close_f.innerText = mainUI.dollarFormat.format(candle.close);
}

/**
* @description shows the UI candle container
*/
const showCandlePanel = function() {
    if(!mainUI.candleDisplay){
        const candleCont = document.getElementById('candle-panel');
        candleCont.style.display = "block";
        mainUI.candleDisplay = true;
    }
}

/**
* @description hides the UI candle container
*/
const hideCandlePanel = function() {
    if(mainUI.candleDisplay){
        const candleCont = document.getElementById('candle-panel');
        candleCont.style.display = "none";
        mainUI.candleDisplay = false;
    }
}

/**
* @description sets the data fields for the point currently being hovered
*  @param {number} pX - the x coordinate of the pointer
*  @param {number} pY - the y coordinate of the pointer
*  @param {number} pZ - the z coordinate of the pointer
*/
const updateHoverPanel = function(pX, pY, pZ){
    if(!mainUI.hover.elem.time || !mainUI.hover.elem.price || !mainUI.hover.elem.vol) {
        const time_f = document.getElementById('hover-time');
        const price_f = document.getElementById('hover-price');
        const vol_f = document.getElementById('hover-vol');
    
        if(!time_f || !vol_f || !price_f){
            throw new Error("Hover Fields Not Found");
        }
        mainUI.hover.elem.time = time_f;
        mainUI.hover.elem.price = price_f;
        mainUI.hover.elem.vol = vol_f;
    }

    const z_eff = pZ - anim.transformZ.position.z;
    const dt_offset = (z_eff / CENV.FRAME_RATE) * 300;
    const dt_eff = new Date((mapData.startTime + dt_offset) * 1000);
    mainUI.hover.elem.time.innerText = dt_eff.toLocaleDateString("en-US") + " - " + dt_eff.toLocaleTimeString("en-US");
    mainUI.hover.elem.vol.innerText = (Math.round((pY * 200.0) * 1000.0)/1000.0).toFixed(3);
    mainUI.hover.elem.price.innerText = mainUI.dollarFormat.format((pX / CENV.MAP_RESOLUTION) * (mapData.maxBuy * 2));
}

/**
* @description shows the UI hover container
*/
const showHoverPanel = function() {
    if(!mainUI.hoverDisplay){
        const hoverCont = document.getElementById('hover-panel');
        hoverCont.style.display = "block";
        mainUI.hoverDisplay = true;
    }
}

/**
* @description hides the UI hover container
*/
const hideHoverPanel = function() {
    if(mainUI.hoverDisplay){
        const hoverCont = document.getElementById('hover-panel');
        hoverCont.style.display = "none";
        mainUI.hoverDisplay = false;
    }
}

const setTimePosition = function(inputPos) {
    if(inputPos > (0 - CENV.FRAME_RATE) && inputPos < ((mapData.snapsTotal * CENV.FRAME_RATE) - (CENV.DISPLAY_DEPTH * CENV.FRAME_RATE))) {
        anim.transformZ.position.z = 0 - inputPos;
        updateAlphaTrans();
        snTime.updateTimeGfx(anim.transformZ.position.z, mapData.snapsTotal);
    }
}

export { initScene, prepareData, setupAnimationEvents }
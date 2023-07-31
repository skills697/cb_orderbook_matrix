// environment variables
const CENV = {
    FRAME_RATE: 10,
    MAP_RESOLUTION: 100,
    MAP_DEPTH: 40,
    DISPLAY_DEPTH: 10,
    MESH_ALPHA: 0.3,
    LINE_ALHPA: 0.7
}

// global variables
var mainScene;
var mainCamera;

var mainUI = { 
    layers: {
        selected: "0"
    },
    selectMesh: [],
    highlightLayer: null,
    hoverLight: null,
    lineSelect: -1,
};

var main3D = {
    engine: null,
    texture: null,
    selectUI: null,
    meshes: [],
    isMeshHover: false,
}

var anim = {
    playing: false,
    transformZ: null,
}

var mapData = {
    maxBuy: 0,
    buys: [],
    sells: [],
}

/**
* Function: prepareData()
* Decription: Retrieve order book snapshot data from server for buys and sells
*/
const prepareData = async () => {
    console.log("Preparing Data");
    const response = await fetch('/api/orderbook');
    const data = await response.json();
    mapData.maxBuy = data.maxBuy;
    mapData.buys = data.buys;
    mapData.sells = data.sells;

    console.log("Creating Scene");
    createScene();
}


/**
* Function: initScene()
* Generate the scene for our data to be rendered
* @param {BABYLON.Engine} main_engine - the main babylon engine
* @param {HTMLCanvasElement} main_canvas - the canvas element
*/
const initScene = function (main_engine, main_canvas) {
    console.log("Initializing Scene");
    var rFrame = 0;
    main3D.engine = main_engine;
    mainScene = new BABYLON.Scene(main3D.engine);

    main3D.texture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("GUI", true, mainScene);    
    mainCamera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0.5 * CENV.MAP_RESOLUTION, 30, 0), mainScene);
    mainCamera.inputs.addMouseWheel();
    mainCamera.setTarget(new BABYLON.Vector3(0.5 * CENV.MAP_RESOLUTION, 25, CENV.MAP_DEPTH * CENV.FRAME_RATE));
    mainCamera.attachControl(main_canvas, true);

    var hlight1 = new BABYLON.HemisphericLight("HemisphericLight1", new BABYLON.Vector3(1, 1, 0));
    hlight1.diffuse = new BABYLON.Color3(0.63, 0.86, 0.97);
    hlight1.specular = new BABYLON.Color3(0.37, 0.59, 0.65);
    hlight1.intensity = 0.65;

    var dlight1 = new BABYLON.DirectionalLight("DirectionalLight1", new BABYLON.Vector3(-0.15, -1, -0.2), mainScene);
    dlight1.diffuse = new BABYLON.Color3(0.97, 0.78, 0.36);
    dlight1.specular = new BABYLON.Color3(1, 0.89, 0.57);
    dlight1.intensity = 0.35;

    mainScene.clearColor = new BABYLON.Color3(0.07, 0.07, 0.11, 0.9);
    anim.transformZ = new BABYLON.TransformNode("root");

    mainUI.highlightLayer = new BABYLON.HighlightLayer("hl1", mainScene);

    mainScene.registerBeforeRender(renderScene);
}


/**
* Function: renderScene()
* Render the scene
*/
const renderScene = function () {
    if(mainUI.hoverLight != null && mainUI.hoverLight.isEnabled() != mainUI.isMeshHover) {
        mainUI.hoverLight.setEnabled(mainUI.isMeshHover);
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
        anim.transformZ.position.z -= 0.1;
        main3D.meshes[mainUI.layers.selected].buys.forEach(setAlphaTrans);
        main3D.meshes[mainUI.layers.selected].sells.forEach(setAlphaTrans);
        mainUI.playSlider.value = 0 - anim.transformZ.position.z;
    }
}

/**
* Function: createScene()
* Generate the scene for our data to be rendered
*/
const createScene = function () {
    createLayer(mainUI.layers.selected);

    mainUI.hoverLight = new BABYLON.PointLight("light", new BABYLON.Vector3(0, 0, 0), mainScene);
    mainUI.hoverLight.diffuse = new BABYLON.Color3(1, 0.9, 0.65);
    mainUI.hoverLight.specular = new BABYLON.Color3(1, 0.9, 0.65);
    mainUI.hoverLight.range = 5;
    mainUI.hoverLight.setEnabled(false);
    

    mainScene.onPointerMove = function (event, pickResult) {
        if (mainUI.isMeshHover) {
            mainUI.hoverLight.position = new BABYLON.Vector3(pickResult.pickedPoint.x, pickResult.pickedPoint.y+1, pickResult.pickedPoint.z);
        }
    }

    mainScene.onPointerDown = (event, pickResult) => {
        if(event.button == 0){
            if(mainUI.lineSelect >= 0) {
                mainUI.highlightLayer.removeMesh(main3D.meshes[mainUI.layers.selected].asks[mainUI.lineSelect][1]);
                mainUI.highlightLayer.removeMesh(main3D.meshes[mainUI.layers.selected].bids[mainUI.lineSelect][1]);
            }

            if(mainUI.isMeshHover) {
                let line_num = Math.round((pickResult.pickedPoint.z - anim.transformZ.position.z - 10.0)/10.0);
                mainUI.highlightLayer.addMesh(main3D.meshes[mainUI.layers.selected].asks[line_num][1], BABYLON.Color3.Red());
                mainUI.highlightLayer.addMesh(main3D.meshes[mainUI.layers.selected].bids[line_num][1], BABYLON.Color3.Red());
                mainUI.lineSelect = line_num;
            }
        }
    };
}

/**
* Function: createLayer(layer_index)
* creates new geometry for a given layer
* @param {number} layer_index - index of layer to create
*/
const createLayer = function(layer_index) {
    // TransformZ[row] -> TransformY -> Mesh
    main3D.meshes[layer_index] = {};
    main3D.meshes[layer_index].transformY = new BABYLON.TransformNode("transY" + hselect);
    main3D.meshes[layer_index].transformY.parent = anim.transformZ;
    main3D.meshes[layer_index].buys = [];
    main3D.meshes[layer_index].sells = [];

    for(var i=0; i < mapData.buys.length; i++){
        var bid_mesh = generateMapRow(i, true);
        bid_mesh.mesh.parent = main3D.meshes[layer_index].transformY;
        bid_mesh.line.parent = main3D.meshes[layer_index].transformY;
        main3D.meshes[layer_index].buys.push([bid_mesh.mesh, bid_mesh.line]);
    }

    for(var i=0; i < mapData.sells.length; i++){
        var ask_mesh = generateMapRow(i, false);
        ask_mesh.mesh.parent = main3D.meshes[layer_index].transformY;
        ask_mesh.line.parent = main3D.meshes[layer_index].transformY;
        main3D.meshes[layer_index].sells.push([ask_mesh.mesh, ask_mesh.line]);
    }
    
    main3D.meshes[layer_index].buys.forEach(setAlphaTrans);
    main3D.meshes[layer_index].sells.forEach(setAlphaTrans);

    // add selected line to highlight layer
    if(mainUI.lineSelect >= 0) {
        mainUI.highlightLayer.addMesh(main3D.meshes[layer_index].buys[mainUI.lineSelect][1], BABYLON.Color3.Red());
        mainUI.highlightLayer.addMesh(main3D.meshes[layer_index].sells[mainUI.lineSelect][1], BABYLON.Color3.Red());
    }
}

/**
* Function: hideLayer(layer_index)
* disables the existing geometry for this layer
* @param {number} layer_index - index of layer to create
*/
const hideLayer = function(layer_index) {
    meshes[layer_index].buys.forEach((val, index) => {
        val[0].setEnabled(false);
        val[1].setEnabled(false);
    });
    meshes[layer_index].sells.forEach((val, index) => {
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
* Function: showLayer(layer_index)
* enables the existing geometry for this layer
* @param {number} layer_index - index of layer to create
*/
const showLayer = function(layer_index) {
    meshes[layer_index].buys.forEach((val, index) => {
        val[0].setEnabled(true);
        val[1].setEnabled(true);
    });
    meshes[layer_index].sells.forEach((val, index) => {
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
* Function: initMapRow(row_index, ind_buy)
* create a new row for our price map
* @param {number} row_index - index of row to create
* @param {boolean} ind_buy - indicates whether this is a buy or sell row
* @returns {object} - object containing the row mesh and line mesh
*/
const generateMapRow = function(row_index, ind_buy) {
    let uniq_name =  ((ind_buy) ? "Buy" : "Sell") + row_index;
    let next_index = (row_index+1) < (ind_buy ? mapData.buys.length : mapData.sells.length) ? (row_index+1) : row_index;
    let geometry_data = [];
    geometry_data.push(getRowGeometry(row_index, ind_buy));
    geometry_data.push(getRowGeometry(next_index, ind_buy));
    let row = BABYLON.MeshBuilder.CreateRibbon("ribbon" + uniq_name, {
        pathArray: geometry_data, 
        closeArray: false, 
        closePath: false, 
        //sideOrientation: (ind_buy) ? BABYLON.Mesh.FRONTSIDE : BABYLON.Mesh.BACKSIDE
        sideOrientation: (ind_buy) ? BABYLON.Mesh.BACKSIDE : BABYLON.Mesh.FRONTSIDE
    });

    let white_mat = new BABYLON.StandardMaterial("rowMat" + uniq_name, mainScene);
    white_mat.wireframe = true;
    row.material = white_mat;
    row.renderingGroupId = 1;
    
    let mline1 = BABYLON.MeshBuilder.CreateLines("meshLine" + uniq_name, { points: geometry_data[0] });
    mline1.color = new BABYLON.Color4(1, 1, 1, 0);

    let mesh_action_manager = new BABYLON.ActionManager(mainScene);

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
* Function:     getRowGeometry(row_index, ind_bid)
* Generates geometry data using the price data
* @param {number} row_index - index of row to create
* @param {boolean} ind_buy - indicates whether this is a buy or sell row
*/
const getRowGeometry = function(row_index, ind_buy){
    //Set up options for price mapping data to 3D geometry
    const priceMap = (ind_buy) ? mapData.buys[row_index] : mapData.sells[row_index];
    const optAdd = (mainUI.layers.selected == 0 || mainUI.layers.selected == 2) ? true : false;
    const optUsd = (mainUI.layers.selected == 2 || mainUI.layers.selected == 3) ? true : false;

    let resPath = [];
    let p1_y = 0;
    for(var i=0; i < priceMap.length; i++){
        resPath.push(new BABYLON.Vector3(
            ((priceMap[i][0] / mapData.maxBuy) * CENV.MAP_RESOLUTION) + (ind_buy ? 0.5 : -0.5),
            (p1_y = (optAdd ? p1_y : 0) + (priceMap[i][1] * (optUsd ? priceMap[i][0]*0.0001 : 1) / 200)),
            (row_index * CENV.FRAME_RATE) + CENV.FRAME_RATE));
    }

    return resPath;
};


/**
* Function:     setupAnimationEvents()
* Setup UI for controlling animations
*/
const setupAnimationEvents = function() {

    // Play Button setup
    mainUI.playButton = document.getElementById("anim-play");
    mainUI.playButton.onmousedown = function() {
        anim.playing = !anim.playing;
        mainUI.playButton.innerHtml = ((anim.playing) ? "Pause" : "Play" ) + " Animation"
    };

    // Animation slider changes
    mainUI.playSlider = document.getElementById("anim-slider");
    mainUI.playSlider.min = 0;
    mainUI.playSlider.max = (CENV.MAP_DEPTH - CENV.DISPLAY_DEPTH) * CENV.FRAME_RATE;
    mainUI.playSlider.oninput = function() {
        anim.transformZ.position.z = 0 - mainUI.playSlider.value;
        meshes[mainUI.layers.selected].buys.forEach(setAlphaTrans);
        meshes[mainUI.layers.selected].sells.forEach(setAlphaTrans);
    };

    // Watch for browser/canvas resize events
    window.addEventListener("resize", function () {
        main3D.engine.resize();
    });

    // selection changes to geometry data
    mainUI.dval = { items: document.getElementsByClassName("bc-dval-opt") };
    selectGeometryEvent();

    mainScene.setRenderingAutoClearDepthStencil(1, false, false);

    // Register a render loop to repeatedly render the scene
    main3D.engine.runRenderLoop(function () {
            mainScene.render();
    });

}

/**
* Function:     setAlphaTrans(alpha_val, index)
* sets the alpha transparency of meshes on render
*  @param {number} alpha_val - alpha value to set, between 0 and 1
*  @param {number} index - index of mesh to set
*/
const setAlphaTrans = function(alpha_val, index) {
    const beginZ = CENV.DISPLAY_DEPTH * CENV.FRAME_RATE;
    let rp = (index * CENV.FRAME_RATE) + anim.transformZ.position.z;
    let alphaOut = 1.0;

    if(rp <= 0.0) 
        // z is negative - fade alpha out
        alphaOut = (10.0 - Math.abs(rp)) / 10.0;
    else if(rp > beginZ) 
        // z is positive - fade alpha in 
        alphaOut = (10.0 - (rp - beginZ)) / 10.0;

    v[0].material.alpha = ((alphaOut < 0.0) ? 0.0 : alphaOut) * CENV.MESH_ALPHA;
    v[1].alpha = ((alphaOut < 0.0) ? 0.0 : alphaOut) * CENV.LINE_ALHPA;
}

/**
* Function:     selectGeometryEvent()
* setup a geometry click event
*/
const selectGeometryEvent = function() {
    if (mainUI.layers.items) {
        for (var i = 0; i < mainUI.layers.items.length; i++) {
            let vit = mainUI.layers.items.item(i);
            vit.setAttribute("selectval", i);
            if (vit.classList.contains("bc-dval-opt-sel"))
                mainUI.layers.selected = i;
            vit.onclick = (event) => {
                if (mainUI.layers.selected != event.target.getAttribute("selectval")) {
                    let prev_item = mainUI.layers.items.item(mainUI.dval.selected);
                    prev_item.classList.remove("bc-dval-opt-sel");
                    prev_item.classList.add("bc-dval-opt-x");
                    event.target.classList.add("bc-dval-opt-sel");
                    event.target.classList.remove("bc-dval-opt-x");
                    hideLayer(mainUI.layers.selected);

                    mainUI.layers.selected = event.target.getAttribute("selectval");
                    if (meshes[mainUI.layers.selected])
                        showLayer(mainUI.layers.selected);

                    else
                        createLayer(mainUI.layers.selected);

                    meshes[mainUI.layers.selected].buys.forEach(setAlphaTrans);
                    meshes[mainUI.layers.selected].sells.forEach(setAlphaTrans);
                }
            };
        }
    }
    else {
        console.log("setupAnimationEvents() :: failed to find options for geometry values");
        console.log(mainUI.dval);
    }
}



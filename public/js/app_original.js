const cenv = {
    frameRate: 10,
    mapResolution: 100,
    mapDepth: 40,
    displayDepth: 10,
    meshAlpha: 0.3,
    lineAlpha: 0.7
}

//order book data values from json results
var mapData = {
    maxBid: 0,
    bids: [],
    asks: [],
}

var meshes = {};
var mainScene;
var mainCamera;

var mainUI = { 
    dval: {
        selected: "0"
    },
    selectMesh: [],
    isMeshHover: false,
    highlightLayer: null,
    hoverLight: null,
    lineSelect: -1,
};

var main3D = {
    engine: null,
    texture: null,
    selectUI: null
}

var anim = {
    playing: false,
    transformZ: null,
}

/*
Function: prepareData()
Decription: Retrieve snapshot data from server for bids and asks
*/
const prepareData = async () => {
    console.log("Begin Data Prep");
    for(var i=0; i < cenv.mapDepth; i++){
        const bid_request = new Request('orders/bids?sid=' + (i+1));
        const bid_res = await fetch(bid_request);
        mapData.bids[i] = await bid_res.json();
        //Check for max bid level, and adjust the geometry grid to scale
        if(mapData.bids[i][mapData.bids[i].length -1][0] > mapData.maxBid) 
            mapData.maxBid = mapData.bids[i][mapData.bids[i].length -1][0];
        
        const ask_request = new Request('orders/asks?sid=' + (i+1));
        const ask_res = await fetch(ask_request);
        mapData.asks[i] = await ask_res.json();
    }
    console.log("Creating Scene");
    createScene(); //Call the createScene function

    //Load the UI elements from JSON
    main3D.selectUI = await main3D.texture.parseFromURLAsync("/select_panel.json");
}


/*
Function: initScene()
Description: Generate the scene for our data to be rendered
*/
const initScene = function (mEngine) {
    console.log("Initializing Scene");
    var rFrame = 0;
    main3D.engine = mEngine
    mainScene = new BABYLON.Scene(main3D.engine);

    main3D.texture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("GUI", true, mainScene);

    //const camera = new BABYLON.ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.5, 15, new BABYLON.Vector3(0, 0, cenv.mapResolution/2));
    /* 
    mainCamera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0.5 * cenv.mapResolution, 50, (cenv.mapDepth-cenv.mapDepth) * cenv.frameRate), mainScene);
    mainCamera.inputs.addMouseWheel();
    mainCamera.setTarget(new BABYLON.Vector3(0.5 * cenv.mapResolution, 34, cenv.mapDepth* cenv.frameRate)); 
    */
    
    //mainCamera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0.5 * cenv.mapResolution, 50, (cenv.mapDepth * cenv.frameRate) - (cenv.displayDepth * cenv.frameRate)), mainScene);
    mainCamera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0.5 * cenv.mapResolution, 30, 0), mainScene);
    mainCamera.inputs.addMouseWheel();
    mainCamera.setTarget(new BABYLON.Vector3(0.5 * cenv.mapResolution, 25, cenv.mapDepth * cenv.frameRate));
    mainCamera.attachControl(canvas, true);

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

    mainScene.registerBeforeRender(function () {
        
        if(mainUI.hoverLight != null && mainUI.hoverLight.isEnabled() != mainUI.isMeshHover) {
            mainUI.hoverLight.setEnabled(mainUI.isMeshHover);
        }

        if(mainUI.lineSelect >= 0) {
            if(meshes[mainUI.dval.selected].bids[mainUI.lineSelect][1].alpha == 0.0
                    && mainUI.highlightLayer.isEnabled) {
                mainUI.highlightLayer.isEnabled = false;
            } else if(meshes[mainUI.dval.selected].bids[mainUI.lineSelect][1].alpha > 0.0
                    && !mainUI.highlightLayer.isEnabled) {
                mainUI.highlightLayer.isEnabled = true;
            }
        }

        if(anim.playing){
            anim.transformZ.position.z -= 0.1;
            meshes[mainUI.dval.selected].bids.forEach(setAlphaTrans);
            meshes[mainUI.dval.selected].asks.forEach(setAlphaTrans);
            mainUI.playSlider.value = 0 - anim.transformZ.position.z;
        }
    });
}

/*
Function: createScene()
Description: Generate the scene for our data to be rendered
*/
const createScene = function () {
    createLayer(mainUI.dval.selected);

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
                mainUI.highlightLayer.removeMesh(meshes[mainUI.dval.selected].asks[mainUI.lineSelect][1]);
                mainUI.highlightLayer.removeMesh(meshes[mainUI.dval.selected].bids[mainUI.lineSelect][1]);
            }

            if(mainUI.isMeshHover) {
                let line_num = Math.round((pickResult.pickedPoint.z - anim.transformZ.position.z - 10.0)/10.0);
                mainUI.highlightLayer.addMesh(meshes[mainUI.dval.selected].asks[line_num][1], BABYLON.Color3.Red());
                mainUI.highlightLayer.addMesh(meshes[mainUI.dval.selected].bids[line_num][1], BABYLON.Color3.Red());
                mainUI.lineSelect = line_num;
            }
        }
    };
}

/*
Function: createLayer(hselect)
Description: creates new geometry for a given layer
*/
const createLayer = function(hselect) {
    // TransformZ[row] -> TransformY -> Mesh
    meshes[hselect] = {};
    meshes[hselect].transformY = new BABYLON.TransformNode("transY" + hselect);
    meshes[hselect].transformY.parent = anim.transformZ;
    meshes[hselect].bids = [];
    meshes[hselect].asks = [];

    for(var i=0; i < mapData.bids.length; i++){
        var bid_mesh = generateMapRow(i, true);
        bid_mesh.mesh.parent = meshes[hselect].transformY;
        bid_mesh.line.parent = meshes[hselect].transformY;
        meshes[hselect].bids.push([bid_mesh.mesh, bid_mesh.line]);
    }

    for(var i=0; i < mapData.asks.length; i++){
        var ask_mesh = generateMapRow(i, false);
        ask_mesh.mesh.parent = meshes[hselect].transformY;
        ask_mesh.line.parent = meshes[hselect].transformY;
        meshes[hselect].asks.push([ask_mesh.mesh, ask_mesh.line]);
    }
    
    meshes[hselect].bids.forEach(setAlphaTrans);
    meshes[hselect].asks.forEach(setAlphaTrans);

    // add selected line to highlight layer
    if(mainUI.lineSelect >= 0) {
        mainUI.highlightLayer.addMesh(meshes[hselect].asks[mainUI.lineSelect][1], BABYLON.Color3.Red());
        mainUI.highlightLayer.addMesh(meshes[hselect].bids[mainUI.lineSelect][1], BABYLON.Color3.Red());
    }

}

/*
Function: hideLayer(hselect)
Description: disables the existing geometry for this layer
*/
const hideLayer = function(hselect) {
    meshes[hselect].bids.forEach((val, index) => {
        val[0].setEnabled(false);
        val[1].setEnabled(false);
    });
    meshes[hselect].asks.forEach((val, index) => {
        val[0].setEnabled(false);
        val[1].setEnabled(false);
    });
    
    // remove selected line from highlight layer
    if(mainUI.lineSelect >= 0) {
        mainUI.highlightLayer.removeMesh(meshes[hselect].asks[mainUI.lineSelect][1]);
        mainUI.highlightLayer.removeMesh(meshes[hselect].bids[mainUI.lineSelect][1]);
    }
}

/*
Function: showLayer(hselect)
Description: enables the existing geometry for this layer
*/
const showLayer = function(hselect) {

    meshes[hselect].bids.forEach((val, index) => {
        val[0].setEnabled(true);
        val[1].setEnabled(true);
    });
    meshes[hselect].asks.forEach((val, index) => {
        val[0].setEnabled(true);
        val[1].setEnabled(true);
    });

    // add selected line to highlight layer
    if(mainUI.lineSelect >= 0) {
        mainUI.highlightLayer.addMesh(meshes[hselect].asks[mainUI.lineSelect][1], BABYLON.Color3.Red());
        mainUI.highlightLayer.addMesh(meshes[hselect].bids[mainUI.lineSelect][1], BABYLON.Color3.Red());
    }
}

/*
Function: generateMapRow(box_index, ind_bid)
Description: generate a row for our price map
*/
const generateMapRow = function(row_index, ind_bid) {
    
    let uniq_name =  ((ind_bid) ? "Bid" : "Ask") + row_index;
    let next_index = (row_index+1) < (ind_bid ? mapData.bids.length : mapData.asks.length) ? (row_index+1) : row_index;
    let geometry_data = [];
    geometry_data.push(getRowGeometry(row_index, ind_bid));
    geometry_data.push(getRowGeometry(next_index, ind_bid));
    let row = BABYLON.MeshBuilder.CreateRibbon("ribbon" + uniq_name, {
        pathArray: geometry_data, 
        closeArray: false, 
        closePath: false, 
        //sideOrientation: (ind_bid) ? BABYLON.Mesh.FRONTSIDE : BABYLON.Mesh.BACKSIDE
        sideOrientation: (ind_bid) ? BABYLON.Mesh.BACKSIDE : BABYLON.Mesh.FRONTSIDE
    });

    let white_mat = new BABYLON.StandardMaterial("rowMat" + uniq_name, mainScene);
    white_mat.wireframe = true;
    row.material = white_mat;
    row.renderingGroupId = 1;
    
    /* var mline1 = BABYLON.MeshBuilder.CreateLines("meshLine" + uniq_name, {
        points: geometry_data[0], 
        colors: geometry_data[0].map( val => new BABYLON.Color4(1,1,1,(val.x - (ind_bid ? 0.5 : -0.5))/cenv.mapResolution) )
    }); */
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

/*
Function:     getRowGeometry()
Description:  Generates geometry data using the price data
*/
const getRowGeometry = function(row_index, ind_bid){
    
    const pMap = (ind_bid) ? mapData.bids[row_index] : mapData.asks[row_index];
    //Set change in Y values to behave additive - currently on UI selections of 0 & 2
    const addTotal = (mainUI.dval.selected == 0 || mainUI.dval.selected == 2) ? true : false;
    const usd = (mainUI.dval.selected == 2 || mainUI.dval.selected == 3) ? true : false;

    var path1 = [];
    var p1_y = 0;
    for(var i=0; i < pMap.length; i++){
        path1.push(new BABYLON.Vector3(
            ((pMap[i][0] / mapData.maxBid) * cenv.mapResolution) + (ind_bid ? 0.5 : -0.5),
            (p1_y = (addTotal ? p1_y : 0) + (pMap[i][1] * (usd ? pMap[i][0]*0.0001 : 1) / 200)),
            (row_index * cenv.frameRate) + cenv.frameRate));
    }

    return path1;
};


/*
Function:     getRowGeometry()
Description:  Generates geometry data using the price data
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
    mainUI.playSlider.max = (cenv.mapDepth - cenv.displayDepth) * cenv.frameRate;
    mainUI.playSlider.oninput = function() {
        anim.transformZ.position.z = 0 - mainUI.playSlider.value;
        meshes[mainUI.dval.selected].bids.forEach(setAlphaTrans);
        meshes[mainUI.dval.selected].asks.forEach(setAlphaTrans);
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

/*
Function:     setAlphaTrans()
Description:  sets the alpha transparency of meshes on render
*/
const setAlphaTrans = function(v, index) {
    let rp = (index * cenv.frameRate) + anim.transformZ.position.z;
    let alp = 1.0;

    // - if current z position is negative fade alpha out
    // - if current z position is less than display depth + framerate, fade alpha in
    if(rp <= 0.0)
        alp = (10.0 - Math.abs(rp)) / 10.0;
    else if(rp > (cenv.displayDepth * cenv.frameRate))
        alp = (10.0 - (rp - (cenv.displayDepth * cenv.frameRate))) / 10.0;

    v[0].material.alpha = ((alp < 0.0) ? 0.0 : alp) * cenv.meshAlpha;
    v[1].alpha = ((alp < 0.0) ? 0.0 : alp) * cenv.lineAlpha;
}

/*
Function:     selectGeometryEvent()
Description:  setup a geometry click event
*/
const selectGeometryEvent = function() {
    if (mainUI.dval.items) {
        for (var i = 0; i < mainUI.dval.items.length; i++) {
            let vit = mainUI.dval.items.item(i);
            vit.setAttribute("selectval", i);
            if (vit.classList.contains("bc-dval-opt-sel"))
                mainUI.dval.selected = i;
            vit.onclick = (event) => {
                if (mainUI.dval.selected != event.target.getAttribute("selectval")) {
                    let prev_item = mainUI.dval.items.item(mainUI.dval.selected);
                    prev_item.classList.remove("bc-dval-opt-sel");
                    prev_item.classList.add("bc-dval-opt-x");
                    event.target.classList.add("bc-dval-opt-sel");
                    event.target.classList.remove("bc-dval-opt-x");
                    hideLayer(mainUI.dval.selected);

                    mainUI.dval.selected = event.target.getAttribute("selectval");
                    if (meshes[mainUI.dval.selected])
                        showLayer(mainUI.dval.selected);

                    else
                        createLayer(mainUI.dval.selected);

                    meshes[mainUI.dval.selected].bids.forEach(setAlphaTrans);
                    meshes[mainUI.dval.selected].asks.forEach(setAlphaTrans);
                }
            };
        }
    }
    else {
        console.log("setupAnimationEvents() :: failed to find options for geometry values");
        console.log(mainUI.dval);
    }
}



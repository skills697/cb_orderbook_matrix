import { CENV } from './cenv.js'

const snTime = {
    gfxLeft: null,
    gfxRight: null,
    gfxSvg: null,
    gfxSelect: null,
    isDragging: false,
};

/**
* @description setup for timeline graphics SVG
*/
snTime.initTimeGfx = function (snapshots) {
    const svgns = 'http://www.w3.org/2000/svg';
    const svgCont = document.getElementById('sn-time-gfx');
    snTime.gfxSvg = svgCont;
    const initPath = document.createElementNS(svgns,"path");
    const snapKeys = Object.keys(snapshots).sort();
    const wSvg = svgCont.clientWidth;
    const hSvg = svgCont.clientHeight;

    let maxSny = 0;
    let minSny = 0;
    const snapsTotal = snapKeys.length;
    snapKeys.forEach((key, index) => {
        const snap = snapshots[key];
        if(index == 0) {
            maxSny = snap.candle.open;
            minSny = snap.candle.open;
        }
        if (maxSny < snap.candle.close) {
            maxSny = snap.candle.close;
        }
        if (minSny > snap.candle.close) {
            minSny = snap.candle.close;
        }
    });

    const vSny = maxSny - minSny;
    let dPath = "";
    snapKeys.forEach((key, index) => {
        const snap = snapshots[key];
        if(index == 0){
            dPath += "M 0 " + (hSvg - (((snap.candle.open - minSny)/vSny) * (100.0/hSvg)));
        }
        dPath += " L " + (wSvg * ((index + 1)/snapKeys.length)) + " " + (hSvg - (((snap.candle.close - minSny)/vSny)  * hSvg));
    });

    initPath.setAttribute("d", dPath);
    initPath.setAttribute("stroke", "#74ff00");
    initPath.setAttribute("stroke-width", "2");
    initPath.setAttribute("fill", "transparent");
    
    const selectLine  = document.createElementNS(svgns,"line");
    selectLine.setAttribute("id", "sn-time-sel-line");
    selectLine.setAttribute("x1", -1);
    selectLine.setAttribute("y1", 0);
    selectLine.setAttribute("x2", -1);
    selectLine.setAttribute("y2", hSvg);
    snTime.gfxSelect = selectLine;

    // Timeline Visual Indicator
    const sW = wSvg / snapsTotal;
    const gapW = sW * CENV.DISPLAY_DEPTH;
    const lrct = document.createElementNS(svgns, "rect");
    lrct.setAttribute("id", "sn-time-l-rect");
    lrct.setAttribute("width", (wSvg + sW));
    lrct.setAttribute("height", "110%");
    lrct.setAttribute("x", (wSvg + sW) * -1);
    snTime.gfxLeft = lrct;

    const rrct = document.createElementNS(svgns, "rect");
    rrct.setAttribute("id", "sn-time-r-rect");
    rrct.setAttribute("width", (wSvg + sW));
    rrct.setAttribute("height", "110%");
    rrct.setAttribute("x", gapW);
    snTime.gfxRight = rrct;
    
    // Left Linear Gradient
    const lgrad = document.createElementNS(svgns, "linearGradient");
    lgrad.setAttribute("id", "sn-time-lg-left");
    lgrad.setAttribute("x1", "0%");
    lgrad.setAttribute("y1", "0%");
    lgrad.setAttribute("x2", "100%");
    lgrad.setAttribute("y2", "0%");

    const stopDataLeft = [[1,"0"], [1,".90"], [0,"1.0"]];
    stopDataLeft.forEach((val, index) => {
        let stop = document.createElementNS(svgns, "stop");
        stop.setAttribute("id", "sn-time-lg-ls"+index);
        stop.setAttribute("offset", val[1]);
        stop.setAttribute("stop-color", "#3a464a");
        stop.setAttribute("stop-opacity", (val[0] ? "25%" : "0%"));
        lgrad.appendChild(stop);
    });

    lrct.setAttribute("fill", "url(#sn-time-lg-left)");

    // Right Linear Gradient
    const rgrad = document.createElementNS(svgns, "linearGradient");
    rgrad.setAttribute("id", "sn-time-lg-right");
    rgrad.setAttribute("x1", "0%");
    rgrad.setAttribute("y1", "0%");
    rgrad.setAttribute("x2", "100%");
    rgrad.setAttribute("y2", "0%");

    const stopDataRight = [[0,"0"], [1,".10"], [1,"1.0"]];
    stopDataRight.forEach((val, index) => {
        let stop = document.createElementNS(svgns, "stop");
        stop.setAttribute("id", "sn-time-lg-rs"+index);
        stop.setAttribute("offset", val[1]);
        stop.setAttribute("stop-color", "#3a464a");
        stop.setAttribute("stop-opacity", (val[0] ? "25%" : "0%"));
        rgrad.appendChild(stop);
    });

    rrct.setAttribute("fill", "url(#sn-time-lg-right)");

    // Add All to SVG (determines display ordering)
    svgCont.replaceChildren(lrct);
    svgCont.appendChild(lrct);
    svgCont.appendChild(rrct);
    svgCont.appendChild(lgrad);
    svgCont.appendChild(rgrad);
    svgCont.appendChild(initPath);
    svgCont.appendChild(selectLine);
}

/**
* @description Update function to keep slider/indicator in sync with current timeline position
*/
snTime.updateTimeGfx = function(timePosition, snapsTotal) {
    const wSvg = snTime.gfxSvg.clientWidth;
    const sW = wSvg / snapsTotal;
    const timeOffset = wSvg * (timePosition / (snapsTotal * CENV.FRAME_RATE))
    const leftStartPos = (wSvg + sW) * -1;
    snTime.gfxLeft.setAttribute("x", leftStartPos - timeOffset)
    const rightStartPos = sW * CENV.DISPLAY_DEPTH;
    snTime.gfxRight.setAttribute("x", rightStartPos - timeOffset)
}

/**
* @description Update function for selecting lineNum
*/
snTime.setSelectedLine = function(lineNum, snapsTotal) {
    snTime.gfxSelect.setAttribute("x1", (line_num / snapsTotal) * snTime.gfxSvg.clientWidth);
    snTime.gfxSelect.setAttribute("x2", (line_num / snapsTotal) * snTime.gfxSvg.clientWidth);
}

export { snTime };
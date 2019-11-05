import React, {Component} from 'react';
import axios from 'axios';
import PopConnect from './PopConnect';
import If from 'babel-plugin-jsx-control-statements';

import '../less/linkage.less'

export default class Model2d3d extends Component {
    constructor() {
        super();
        this.state = {
            cHeight: document.documentElement.clientHeight - 105 - 40,
            viewToken:'',
            showErrorNote:false,
            isConnecting: false,
            isPopConnect:false,
            currentDwgIndex: 0,
            addDwgIndex: null,
            chosing: false,
            floors: null,
            drawingList: [],
            connectList:[],
            connectData:{},
            step: 0,
            pos3D: [],
            pos2D: [],
            connectDwgShow:false,
        };
    }

    componentDidMount(){
        axios.get('https://bimface.com/api/console/share/preview/viewtoken?token=a52f9e85').then((res)=>{
            if(res.data.code == 'success'){
                this.setState({viewToken:res.data.data},()=>{
                    this.getMode();
                })
            }
        })
    }

    // 加载模型和图纸
    getMode(){
        var viewToken = this.state.viewToken;
        var options = new BimfaceSDKLoaderConfig();
        options.viewToken = viewToken;
        BimfaceSDKLoader.load(options, successCallback, failureCallback);

        var that = this;
        function successCallback(viewMetaData) {
            var dom3d = document.getElementById('view3d');
            var config = new Glodon.Bimface.Application.WebApplication3DConfig();
            config.domElement = dom3d;
            config.Toolbars = [];
            window.app = new Glodon.Bimface.Application.WebApplication3D(config);
            app.addView(viewToken);
            window.ViewerEvent3D = Glodon.Bimface.Viewer.Viewer3DEvent;

            // 监听添加view完成的事件
            app.addEventListener(Glodon.Bimface.Viewer.Viewer3DEvent.ViewAdded, function() {
                // 渲染3D模型
                app.render();
                window.viewer3D = app.getViewer();
                // 标签类的设置
                var drawable3dConfig = new Glodon.Bimface.Plugins.Drawable.DrawableContainerConfig();
                drawable3dConfig.viewer = viewer3D;
                window.drawable3dContainer = new Glodon.Bimface.Plugins.Drawable.DrawableContainer(drawable3dConfig);


                var options2d = new BimfaceSDKLoaderConfig();
                options2d.viewToken = viewToken;
                options2d.viewType = BimfaceViewTypeOption.DrawingView;
                BimfaceSDKLoader.load(options2d, successCallback2d, failureCallback2d);

                function successCallback2d(viewMetaData) {
                    var dom2d = document.getElementById('view2d');
                    var config2d = new Glodon.Bimface.Viewer.ViewerDrawingConfig();
                    config2d.domElement = dom2d;
                    window.viewerDrawing = new Glodon.Bimface.Viewer.ViewerDrawing(config2d);
                    window.ViewerEvent = Glodon.Bimface.Viewer.ViewerDrawingEvent;
                    // 二三维联动
                    app.addEventListener(ViewerEvent3D.ComponentsSelectionChanged, that.handelModel3DConnect);
                    viewerDrawing.addEventListener(ViewerEvent.ComponentsSelectionChanged,that.handelModel2DConnect);
                    //获取导出图纸列表
                    viewer3D.getAllDrawingsheets(function(data) {
                        let drawingList = data.drawingList;
                        that.setState({ drawingList: data.drawingList });
                        viewerDrawing.load(viewToken,drawingList[0].viewInfo.id);
                    });
                    //获取楼层
                    viewer3D.getFloors(function(data) {
                        that.setState({ floors: data });
                    });

                    viewer3DExtend()
                }

                function failureCallback2d(error){
                    console.log(error);
                }

                function viewer3DExtend() {
                    app.addEventListener(ViewerEvent3D.Rendered, function () {
                        if(!that.state.isConnecting && that.state.connectDwgShow) {
                            let cameraStatus = viewer3D.getCameraStatus()
                            that.setCameraPos(cameraStatus);
                            that.setCameraFov(cameraStatus);
                        }
                    });
                }

            })
        }

        function failureCallback(error) {
            console.log(error);
        };
    }

    // 加载关联图纸
    loadDwg = (shareToken) => {
        const me = this;
        axios.get(`https://bimface.com/api/console/share/preview/viewtoken?token=${shareToken}`).then((res)=>{
            if(res.data.code == 'success'){
                var viewToken = res.data.data;
                var BimfaceLoaderConfig = new BimfaceSDKLoaderConfig();
                BimfaceLoaderConfig.viewToken = viewToken;
                BimfaceSDKLoader.load(BimfaceLoaderConfig,successCallback,failureCallback);
      
                function successCallback(viewMetaData) {   
                    var dom4Show = document.getElementById('viewDwg');
                    dom4Show.innerHTML = '';
                    var webAppConfig = new Glodon.Bimface.Viewer.ViewerDrawingConfig();
                    webAppConfig.domElement = dom4Show;
                    window.viewerDwg = new Glodon.Bimface.Viewer.ViewerDrawing(webAppConfig);
                    viewerDwg.load(viewToken);
                    // 标签类的设置
                    var drawable2dConfig = new Glodon.Bimface.Plugins.Drawable.DrawableContainerConfig();
                    drawable2dConfig.viewer = viewerDwg;
                    // 容器
                    window.drawable2dContainer = new Glodon.Bimface.Plugins.Drawable.DrawableContainer(drawable2dConfig);

                    viewerDwgExtend();       
                }  
                
                function failureCallback(error) {
                  console.log(error);
                };

                function viewerDwgExtend() {
                    viewerDwg.addEventListener(ViewerEvent.Loaded, function () {
                        me.renderCameraNode();
                        if(me.state.isConnecting) {
                            viewerDwg.addEventListener(ViewerEvent.MouseClicked, me.get2DPos);
                            viewerDwg.enableSnap(true);
                        } else {
                            viewerDwg.addEventListener(ViewerEvent.MouseClicked, me.locateTo3D);
                        }
                    });
                }
            }
        })
    }
    
    // 选模型关联图纸
    handelModel3DConnect = (el) => {
        var did = viewerDrawing.toDrawingId(el.objectId);
        if(did){
            viewerDrawing.zoomToObject(did);
        } else {
            this.setState({showErrorNote:true},()=>{
                setTimeout(()=>{this.setState({showErrorNote:false})},3000);
            })
        }
    }

    // 选图纸关联模型
    handelModel2DConnect = (el) => {
        if(el && el.length > 0){
            var rid = viewerDrawing.toModelId(el[0]);
            viewer3D.clearIsolation();
            viewer3D.setSelectedComponentsById([rid]);
            var isExist = viewer3D.getViewer().getComponentInfoByUserId(rid);
            if(isExist) {
                viewer3D.isolateComponentsById([rid], Glodon.Bimface.Viewer.IsolateOption.MakeOthersTranslucent);viewer3D.zoomToSelectedComponents();
                viewer3D.setCameraType('PerspectiveCamera', 45);
            }else {
                viewer3D.clearIsolation();
                viewer3D.render()
            }
        } else {
            this.setState({showErrorNote:true},()=>{
                setTimeout(()=>{this.setState({showErrorNote:false})},3000);
            })
        }
    }

    // 选择导出的图纸
    onDrawingClick = (id,index) => () => {
        this.setState({
            currentDwgIndex: index,
            connectDwgShow: false,
        });
        const viewToken = this.state.viewToken;
        viewerDrawing.load(viewToken, id);
    }
    // 选择关联的图纸
    onConnectDwgClick = (shareToken, i) => () => {
        this.loadDwg(shareToken);
        this.setState({
            currentDwgIndex: `connect${i}`,
            connectDwgShow: true,
        })
    }

    //取消关联按钮
    onCancelConnect = () => {
        const { currentDwgIndex, connectList, viewToken, drawingList } = this.state;
        this.setState({
            isConnecting: false,
            step: 0,
        },()=> {
            viewer3D.resize();
        })
        this.setDefault3D();
        app.removeEventListener(ViewerEvent3D.MouseClicked, this.get3DPos);
        viewer3D.enableSnap(false);
        drawable3dContainer.clear();
        if(window.viewerDwg) {
            viewerDwg.setDisplayMode(0);
            viewerDwg.removeEventListener(ViewerEvent.MouseClicked, this.get2DPos); 
            viewerDwg.enableSnap(false); 
            drawable2dContainer.clear();
        }
        const current = currentDwgIndex.toString();
        if(current.indexOf('connect') != -1) {
            const i= currentDwgIndex.replace(/[^0-9]/ig,"");
            viewerDwg.resize();
            this.loadDwg(connectList[i].shareToken);
        } else {
            this.setState({
                connectDwgShow: false,
            })
            viewerDrawing.load(viewToken, drawingList[currentDwgIndex].viewInfo.id);
        }
    }

    // 弹出关联弹层
    onPopConnect = () => {
        this.setState({isPopConnect: true});
    } 

    // 关闭弹层
    handlePopClose = () => {
        this.setState({isPopConnect: false});
    }

    // 设置关联的图纸
    handleConnect = (floor, dwg) => {
        this.setState({
            isConnecting:true,
            step:1,
            connectData: {
                'floor': floor,
                'dwgShareToken': dwg.shareToken,
                'dwgName':dwg.name
            },
            pos3D: [],
            pos2D: [],
        }, () => {
            this.step1Choose3D();
            //提前加载Step2的图纸
            this.step2Choose2D();
        })
        this.handlePopClose();
    }

    // step1确认
    onStep1Done = () => {
        if(this.state.pos3D.length > 1) {
            this.setState({
                step:2,
                connectDwgShow: true,
            }, () => {
                window.viewerDwg ? viewerDwg.resize() : null;
                app.removeEventListener(ViewerEvent3D.MouseClicked, this.get3DPos);
            })
        } else {
            return;
        }
    }

    // step2确认
    onStep2Done = () => {
        if(this.state.pos2D.length > 1) {
            this.setState({
                step:3,
            }, ()=> {
                this.setConnect3D();
                this.step3Confirm();
                this.matchPos();
            })
        } else {
            return;
        }
    }

    //step3确认
    onStep3Done = () => {
        const { connectData, connectList} = this.state;
        let newConnectList = connectList;
        newConnectList = newConnectList.concat([{
            name: connectData.dwgName,
            shareToken: connectData.dwgShareToken,
            elevation: connectData.floor.elevation,
            pos3D: this.state.pos3D,
            pos2D: this.state.pos2D,
        }]);
        //数组对象去重
        let obj = {};
        newConnectList=newConnectList.reduce((curs,next)=>{
            obj[next.shareToken] ? "" : obj[next.shareToken] = true && curs.push(next);
            return curs;
        }, []);
        let i = newConnectList.length - 1;
        this.setState({
            isConnecting: false,
            step:0,
            connectData: {},
            connectList: newConnectList,
            currentDwgIndex: `connect${i}`,
        }, ()=> {
            // resize
            viewer3D.resize();
            const zoomValue = 1 / viewerDwg.getViewer().getZoomFactor();
            viewerDwg.zoom(zoomValue);
            viewerDwg.resize();
        })
        // 模型回到初始视角
        this.setDefault3D();
        viewer3D.getViewer().goToInitialView();
        viewerDwg.setDisplayMode(0);
        drawable2dContainer.clear();
        drawable3dContainer.clear();
        // 去掉坐标监听
        app.removeEventListener(ViewerEvent3D.MouseClicked, this.get3DPos);
        viewerDwg.removeEventListener(ViewerEvent.MouseClicked, this.get2DPos);
        // 恢复滚轮缩放
        CLOUD.EditorConfig.NoZoom = false;
        viewerDwg.addEventListener(ViewerEvent.MouseClicked, this.locateTo3D);  
    }

    //模型关联状态
    setConnect3D = () => {
        const { floor } = this.state.connectData;
        // 模型仅显示指定楼层
        viewer3D.hideAllComponents();
        viewer3D.showComponentsByObjectData([{ "levelName": floor.name }]);
        // 视角切换至顶视图
        viewer3D.hideViewHouse();
        viewer3D.setView(Glodon.Bimface.Viewer.ViewOption.Top);
        // 透视模式设为正交 
        viewer3D.setCameraType('OrthographicCamera');
        // 模型视角锁定顶视图，只能平移缩放，不可旋转 
        viewer3D.enableOrbit(false);
        // 开启轴网 
        viewer3D.showAxisGridsByFloor('', floor.id);
        // 开启点、线、面捕捉以及轴网捕捉
        viewer3D.enableSnap(true);
        viewer3D.render();
    }
    //模型回到初始
    setDefault3D = () => {
        viewer3D.showAllComponents();
        viewer3D.showViewHouse();
        viewer3D.setView(Glodon.Bimface.Viewer.ViewOption.Home);
        viewer3D.setCameraType('PerspectiveCamera');
        viewer3D.enableOrbit(true);
        viewer3D.removeAllAxisGrids();
        viewer3D.getViewer().goToInitialView();
        viewer3D.render();
    }

    // 关联图纸第一步：模型选点
    step1Choose3D = () => {
        viewer3D.resize();
        // 去除联动
        app.removeEventListener(ViewerEvent3D.ComponentsSelectionChanged, this.handelModel3DConnect);
        viewerDrawing.addEventListener(ViewerEvent.ComponentsSelectionChanged,this.handelModel2DConnect);   
        app.addEventListener(ViewerEvent3D.MouseClicked, this.get3DPos);
        this.setConnect3D();
    }

    // 关联图纸第二步：图纸选点
    step2Choose2D = () => {
        let shareToken = this.state.connectData.dwgShareToken;
        this.loadDwg(shareToken);
    }

    // 关联图纸第三步：确认关联
    step3Confirm = () => {
        // 图纸黑白模式
        viewerDwg.home();
        viewerDwg.setDisplayMode(2);
        // 去掉坐标监听
        app.removeEventListener(ViewerEvent3D.MouseClicked, this.get3DPos);
        viewerDwg.removeEventListener(ViewerEvent.MouseClicked, this.get2DPos);
        viewerDwg.enableSnap(false);
        viewer3D.enableSnap(false);
        //去掉滚轮缩放
        CLOUD.EditorConfig.NoZoom = true;
    }

    // 匹配选点
    matchPos = () => {
        const { pos2D, pos3D } = this.state;
        //获取3d对应clientPos
        let new3DClientPos = [];
        pos3D.map(item => {
            let pos = viewer3D.worldToClient(item.worldPosition);
            new3DClientPos.push(pos);
        })
        // 获取3D 两点间距
        const x3d = Math.abs(new3DClientPos[1].x - new3DClientPos[0].x);
        const y3d = Math.abs(new3DClientPos[1].y - new3DClientPos[0].y); 
        const zoom3d = Math.sqrt(Math.pow(x3d,2) + Math.pow(y3d,2));
        // 获取2D 两点间距
        const x2d = Math.abs(pos2D[1].clientPosition.x - pos2D[0].clientPosition.x);
        const y2d = Math.abs(pos2D[1].clientPosition.y - pos2D[0].clientPosition.y); 
        const zoom2d = Math.sqrt(Math.pow(x2d,2) + Math.pow(y2d,2));
        // 获取缩放倍数
        const zoomValue = zoom3d / zoom2d;
        viewerDwg.zoom(zoomValue);
        viewerDwg.getViewer().panTo(new3DClientPos[0]);
        console.log('模型选点最新clientPos：', new3DClientPos);
        console.log('图纸缩放比：',zoomValue);
        // 获取3D中心点
        // const boxWorldPos = viewer3D.getViewer().getScene().getBoundingBoxWorld().getCenter();
        // const centerClientPos = viewerDwg.worldToClient(boxWorldPos);
        // viewerDwg.getViewer().panTo(centerClientPos);
    }

    // 获取模型选点坐标
    get3DPos = (el) => {
        console.log('3D el',el)
        let worldPosition = viewer3D.clientToWorld(el.clientPosition);
        let newPos = this.state.pos3D;
        newPos = newPos.concat([{
            clientPosition: el.clientPosition,
            screenPosition: el.screenPosition,
            worldPosition: worldPosition,
        }])
        if(newPos.length > 2) {
            newPos.splice(0,1);      
        }
        this.setState({
            pos3D: newPos,
        });
        this.addLabel(worldPosition, '3D')
    }

     // 获取图纸选点坐标
     get2DPos = (el) => {
        console.log('2D el',el)
        let newPos = this.state.pos2D;
        newPos = newPos.concat([{
            clientPosition: el.clientPosition,
            screenPosition: {
                x: el.clientX,
                y: el.clientY,
            },
            worldPosition: el.worldPosition,
        }])
        if(newPos.length > 2) {
            newPos.splice(0,1);      
        }
        this.setState({
            pos2D: newPos,
        });
        this.addLabel(el.worldPosition, '2D')
    }

    // 选点标记，自定义标签
    addLabel = (position, type) => {
        let config = new Glodon.Bimface.Plugins.Drawable.CustomItemConfig(); 
        let customItem;
        let labelArr;
        const dotWrap = document.createElement('div')
        const dotLabel1 = document.createElement('span');
        const dotLabel2 = document.createElement('span');
        dotWrap.appendChild(dotLabel1);
        dotWrap.appendChild(dotLabel2);
        //自定义样式，支持Html的任意dom元素
        dotWrap.style.position = 'relative';

        dotLabel1.style.position = 'absolute';
        dotLabel1.style.top = '-7px';
        dotLabel1.style.left = '0';
        dotLabel1.style.width = '2px';
        dotLabel1.style.height = '15px';
        dotLabel1.style.background = '#F99D0B';

        dotLabel2.style.position = 'absolute';
        dotLabel2.style.top = '0';
        dotLabel2.style.left = '-7px';
        dotLabel2.style.width = '15px';
        dotLabel2.style.height = '2px';
        dotLabel2.style.background = '#F99D0B';

        config.content = dotWrap;
        config.worldPosition = position;
        
        type == '3D' ? config.viewer = viewer3D : config.viewer = viewerDwg;
        customItem = new Glodon.Bimface.Plugins.Drawable.CustomItem(config);
        // 添加自定义标签
        if(type == '3D') {
            labelArr = drawable3dContainer.getAllItems();
            labelArr.length == 2 ? drawable3dContainer.removeItemById(labelArr[0].id) : '';
            drawable3dContainer.addItem(customItem);
        } else if(type == '2D') {
            labelArr = drawable2dContainer.getAllItems();
            labelArr.length == 2 ? drawable2dContainer.removeItemById(labelArr[0].id) : '';
            drawable2dContainer.addItem(customItem);
        }
    }


    // 图模联动
    locateTo3D = (el) => {
        const { connectList, currentDwgIndex } = this.state;
        const i= currentDwgIndex.replace(/[^0-9]/ig,""); // 关联图纸第几个被选中；
        let firstPos2D = connectList[i].pos2D[0].worldPosition;
        let secPos2D = connectList[i].pos2D[1].worldPosition;
        let firstPos3D = connectList[i].pos3D[0].worldPosition;
        let secPos3D = connectList[i].pos3D[1].worldPosition;
        // x
        const x2D = Math.abs(secPos2D.x - firstPos2D.x);
        const x3D = Math.abs(secPos3D.x - firstPos3D.x);
        const xZoom = x3D / x2D;
        const xPos = xZoom * (el.worldPosition.x - firstPos2D.x) + firstPos3D.x;
        // y
        const y2D = Math.abs(secPos2D.y - firstPos2D.y);
        const y3D = Math.abs(secPos3D.y - firstPos3D.y);
        const yZoom = y3D / y2D;
        const yPos = yZoom * (el.worldPosition.y - firstPos2D.y) + firstPos3D.y;
        // z
        const zPos = connectList[i].elevation + 1600;
        
        let worldPos = {x: xPos, y: yPos, z: zPos}
        viewer3D.getViewer().locateToPointWithParallelEye(worldPos);
        console.log('当前点击坐标：', el.worldPosition);
        console.log('最终计算坐标：', worldPos)
    }

    // 返回上一步
    backStep = () => {
        let backstep = this.state.step;
        backstep = backstep - 1;
        this.setState({ step: backstep });
        if(backstep == 1) {
            app.addEventListener(ViewerEvent3D.MouseClicked, this.get3DPos);
        } else if(backstep == 2) {
            viewerDwg.addEventListener(ViewerEvent.MouseClicked, this.get2DPos);
            viewerDwg.home();
            viewerDwg.enableSnap(true);
            viewerDwg.setDisplayMode(0);
        }
    }
    //设置相机位置
    setCameraPos = (cameraStatus) => {
        let camera2DPos = viewerDwg.worldToClient(cameraStatus.position);
        const x = Math.abs(cameraStatus.target.x - cameraStatus.position.x);
        const y = Math.abs(cameraStatus.target.y - cameraStatus.position.y);
        const rotateValue = 0 - Math.atan2(y,x) * 180 / Math.PI;
        let posX;
        let posY;
        const maxPosX = (document.documentElement.clientWidth - 240)/2 - 15;
        const maxPosY = document.documentElement.clientHeight - 145 - 30;

        // posX
        if(camera2DPos.x < 0) {
            posX = 0;
        } else if(camera2DPos.x > maxPosX) {
            posX = maxPosX;
        } else {
            posX = camera2DPos.x;
        }
        // posY
        if(camera2DPos.y < 0) {
            posY = 0;
        } else if(camera2DPos.y > maxPosY) {
            posY = maxPosY;
        } else {
            posY = camera2DPos.y;
        }

        cameraWrap.style.top = posY;
        cameraWrap.style.left = posX;
        cameraWrap.setAttribute("transform", "rotate(" + rotateValue + ")");
        cameraWrap.setAttribute('opacity', '1');
    }

    //设置相机广角状态
    setCameraFov = (cameraStatus) => {
        let bbox = viewer3D.getViewer().getBoundingBoxWorld();
        let isInBox = bbox.containsPoint(cameraStatus.position);
        isInBox ? viewer3D.setCameraType('PerspectiveCamera', 120) : viewer3D.setCameraType('PerspectiveCamera', 45);
    }

    // 初始化相机图形节点
    renderCameraNode = () => {
        const xmlns = "http://www.w3.org/2000/svg";
        window.cameraWrap = document.createElementNS(xmlns, 'svg');
        cameraWrap.setAttribute('width','30');
        cameraWrap.setAttribute('height','20');
        cameraWrap.setAttribute('opacity','0');
        cameraWrap.style.position = 'absolute';
        cameraWrap.style.top = '0';
        cameraWrap.style.left = '0';
        cameraWrap.style.zIndex = '9';

        const cameraNode = document.createElementNS(xmlns, 'g');
        cameraNode.setAttribute('fill', '#11DAB7');
        cameraNode.setAttribute('stroke', '#cbd7e1');
        cameraNode.setAttribute('stroke-width', '1');
        cameraNode.setAttribute('stroke-linejoin', 'round'); 
        cameraNode.setAttribute("transform", "translate(8,8)");

        // 尺寸大小 直径 12px
        const circle = document.createElementNS(xmlns, 'circle');
        circle.setAttribute('r', '6');
        const path = document.createElementNS(xmlns, 'path');
        path.setAttribute('d', 'M 7 6 Q 10 0, 7 -6 L 19 0 Z');

        cameraNode.appendChild(circle);
        cameraNode.appendChild(path);
        cameraWrap.appendChild(cameraNode);
        document.querySelector('#viewDwg').appendChild(cameraWrap);
    }

    renderExportDrawing() {
        const { drawingList, currentDwgIndex } = this.state;
        return (
            <div className="drawing-list">
                <div className="title">
                  导出的图纸
                  <i className="iconfont icon-information-"></i>
                  <div className="brief">Revit正向出土产生的图纸，即由模型生成的图纸，可以与三维模型进行构件联动及位置联动。</div>
                </div>
                <ul className="detail">
                    {drawingList.map((item,i) => (
                        <li key={i} 
                            className={i === currentDwgIndex ? 'active' : null}
                            onClick={this.onDrawingClick(item.viewInfo.id, i)}>
                            {item.viewInfo.name}
                        </li>
                    ))}
                </ul>
            </div>
        )
    }

    renderRelateDrawing() {
        const {floors,connectList,currentDwgIndex} = this.state;
        return(
            <div className="drawing-list">
                <div className="title">
                    关联的图纸
                    <i className="iconfont icon-information-"></i>
                    <div className="brief">CAD绘制的图纸，即绘制模型的材料，在进行图模关联后可实现图纸与三维模型的位置联动。</div>
                    { floors ? 
                        <span className='btn btn-primary' onClick={this.onPopConnect}>关联图纸</span> 
                        :
                        <span className='btn btn-disable'>关联图纸</span> 
                    }
                </div>
                <ul className="detail">
                    {connectList.map((item,i) => (
                        <li key={i}
                            className={`connect${i}` === currentDwgIndex ? 'active' : null}
                            onClick={this.onConnectDwgClick(item.shareToken, i)}>
                            {item.name}
                        </li>
                    ))}
                </ul>
            </div>
        )
    }

    renderStep() {
        const { step } = this.state;
        return(
            <div className="stepbox">
                <div className="title">关联图纸</div>
                <ul className="step">
                    <li className={step == 1? 'active' : null}>
                        <i>1</i>
                        选择模型基准点<span>请在模型上选择两个对齐基准点</span>
                    </li> 
                    <li className={step == 2? 'active' : null}>
                        <i>2</i>
                        选择图纸基准点<span>请在图纸上选择两个对齐基准点</span>
                    </li> 
                    <li className={step == 3? 'active' : null}>
                        <i>3</i>
                        确认关联<span>请确认模型与图纸关联位置</span>
                    </li> 
                </ul>
                <span className="btn btn-default" onClick={this.onCancelConnect}>取消关联</span>
            </div>
        )
    }

    renderConnectBtn() {
        const { step, pos3D, pos2D } = this.state;
        let btnStep1;
        let btnStep2;
        pos3D.length < 2 ? btnStep1 = "btn btn-disable"  : btnStep1 = "btn btn-primary";
        pos2D.length < 2 ? btnStep2 = "btn btn-disable"  : btnStep2 = "btn btn-primary";
        return(
            <div className="connectbtn">
                <If condition={step == 1}>
                    <span className={btnStep1} onClick={this.onStep1Done}>确认选点</span>
                </If>
                <If condition={step == 2}>
                    <span className="btn btn-default" onClick={this.backStep}>上一步</span>
                    <span className={btnStep2} onClick={this.onStep2Done}>确认选点</span>
                </If>
                <If condition={step == 3}>
                    <span className="btn btn-default" onClick={this.backStep}>上一步</span>
                    <span className="btn btn-primary" onClick={this.onStep3Done}>确认关联</span>
                </If>
            </div>
        )
    }

    render() {
        const { floors, 
                isConnecting,
                isPopConnect,
                showErrorNote, 
                step,
                connectDwgShow,
                connectList,
                cHeight,
            } = this.state;
        let mainCls;
        let mainStyle;
        if(step) {
            mainCls = `main step${step}`;
            mainStyle = cHeight - 50 + 'px';
        } else {
            mainCls = "main";
            mainStyle = "100%";
        }
        let viewDwgCls = "";
        connectDwgShow ? "" : viewDwgCls = "hide";

        return (
            <div className="container" style={{height:cHeight + 'px'}}>
                <div className="side">
                    {this.renderExportDrawing()} 
                    {this.renderRelateDrawing()}
                     <If condition={isConnecting}>
                        {this.renderStep()}
                    </If>
                </div>
                <div className={mainCls} style={{height: mainStyle}}>
                    <div id="view2d"></div>
                    <div id="view3d"></div>
                    <div id="viewDwg" className={viewDwgCls}></div>
                    {this.renderConnectBtn()}
                    <div className="cover"></div>
                </div>
                <If condition={showErrorNote}>
                    <div className="errorNote">          
                        <i className="iconfont icon-information--fill"></i>未找到对应的二维构件
                    </div>
                </If>
                <If condition={isPopConnect}>
                    <PopConnect floors={floors} 
                                connectList={connectList}
                                onClose={this.handlePopClose} 
                                onConnect={this.handleConnect} />
                </If>
            </div>
        )
    }
}
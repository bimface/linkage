import React, {Component} from 'react';
import PropTypes from 'prop-types';
import If from 'babel-plugin-jsx-control-statements';
import '../less/linkage.less'

class PopConnect extends Component {
    state = {
        addDwgIndex: null,
        isChoseFloor: false,
        chosenFloor: [],
        chosenDwg: {},
        relateDrawing: [{
            name: '1层平面图',
            shareToken: 'cf3d8d92',
            isRelate: false,
        },{
            name: '2层平面图',
            shareToken: '28329b24',
            isRelate: false,
        },{
            name: '3层平面图',
            shareToken: 'c8965da2',
            isRelate: false,
        }],
    };

    componentDidMount() {
        let newRelateDrawing = this.state.relateDrawing;
        newRelateDrawing.forEach(item => {
            this.props.connectList.map(itemConnected => {
                itemConnected.shareToken == item.shareToken ? item.isRelate = true : '';
            })
        })
        this.setState({
            relateDrawing: newRelateDrawing,
        })
    }

    onChose = () => {
        this.setState({isChoseFloor: true});
    }

    onChoseFloor = (floor) => () => {
        this.setState({
            isChoseFloor: false,
            chosenFloor: floor,
        });
    }

    onAddDwg = (index,name,shareToken) => () => {
        this.setState({
            addDwgIndex: index,
            chosenDwg:{
                name: name,
                shareToken: shareToken,
            },
        });
    } 

    handlePopClose = () => {
        this.props.onClose();
    }

    handleConnect = () => {
        const {addDwgIndex,chosenFloor,chosenDwg,relateDrawing} = this.state;
        if(addDwgIndex != null && chosenFloor.name) {
            this.props.onConnect(chosenFloor,chosenDwg);
        } else {
            return;
        } 
    }

    render() {
        const { floors } = this.props;
        const { addDwgIndex, isChoseFloor, chosenFloor, relateDrawing} = this.state;
        let btnCls;
        let choseCls;
        if(addDwgIndex != null && chosenFloor.name) {
            btnCls='btn btn-primary';
        } else {
            btnCls='btn btn-disable';
        } 
        !isChoseFloor ? choseCls='floor-chose' : choseCls='floor-chose on';
        return (
            <div>
                <div className="popup-mask"></div>
                <div className="popup popup-floor">
                    <div className="head">关联图纸<span className="iconfont icon-close16" onClick={this.handlePopClose}></span></div>
                    <div className="content">
                        <div>请选择要关联的楼层</div>
                        <div className={choseCls}>
                            <div className="floor-title" onClick={this.onChose}>
                                {chosenFloor.name}
                                <i className="iconfont icon-arrowdown16"></i>
                            </div>
                            <ul className="floor-list">
                                {floors.map(item => 
                                    <li value={item.id} 
                                        key={item.id}
                                        onClick={this.onChoseFloor(item)}
                                    >{item.name}</li>
                                )}
                            </ul>
                        </div>
                        请选择要关联的图纸（选择已关联的图纸可调整关联位置）
                        <ul className="adddwg">
                            {relateDrawing.map((item,i) => (
                                <li key={i} 
                                    onClick={this.onAddDwg(i,item.name,item.shareToken)}
                                    className={i === addDwgIndex ? 'on' : null}
                                >
                                    {item.name}
                                    <If condition={item.isRelate}>
                                        <span>已关联</span>
                                    </If>
                                </li>
                            ))}
                        </ul>
                        <span className={btnCls} onClick={this.handleConnect}>开始关联图纸</span>
                    </div>
                </div>
            </div>
        )
    }
}

const propTypes = {
    floors: PropTypes.array,
    connectList: PropTypes.array,
  };
  
  const defalutProps = {
    floors: [],
    connectList: [],
  };
  
  PopConnect.propTypes = propTypes;
  PopConnect.defalutProps = defalutProps;
  
  export default PopConnect;
  
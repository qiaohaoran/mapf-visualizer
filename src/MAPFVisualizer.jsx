// React 的主要组件导入，以及其他所需的库和组件
import React, { Component } from "react";
import SendIcon from "@mui/icons-material/Send"; // 发送的图标
import AddIcon from "@mui/icons-material/Add"; // 添加的图标
import DeleteIcon from "@mui/icons-material/Delete"; // 删除的图标
import SingleGrid from "components/Grid"; // 单个网格的子组件
import LoadingAnimation from "components/LoadingAnimation"; // 加载过程中的动画组件
import PlanningResult from "components/PlanningResult"; // 显示规划结果的组件
import BaseLayout from "layouts/sections/components/BaseLayout"; // 页面布局组件
import {
  Slide, Modal, Grid, Switch, Divider, Container, FormControlLabel, Radio,
  RadioGroup, Slider, Typography,  // 从 Material-UI 导入的一些 UI 组件
} from "@mui/material";
import MKTypography from "components/MKTypography"; // 自定义的字体组件
import MKBox from "components/MKBox"; // 自定义 Box 布局组件
import MKInput from "components/MKInput"; // 自定义输入框组件
import MKButton from "components/MKButton"; // 自定义按钮组件
import UploadMap from "components/UploadMap"; // 处理地图上传的组件
import randomColor from "randomcolor"; // 用于生成随机颜色的库

// 定义默认的地图行数和列数
const DEFAULTROW = 8;
const DEFAULTCOL = 15;

// 定义主组件 MAPFVisualizer，用于实现多智能体路径规划可视化
class MAPFVisualizer extends Component {
  // 构造函数，初始化组件的状态
  constructor(props) {
    super(props);
    this.state = {
      // 地图行数和列数
      numRow: DEFAULTROW,
      numCol: DEFAULTCOL,

      // 当前地图的临时行列数（用于可视化调整）
      tempRow: DEFAULTROW,
      tempCol: DEFAULTCOL,

      // 初始化地图的数据结构，每个单元格包含关键信息
      map: new Array(DEFAULTROW).fill().map(() =>
          new Array(DEFAULTCOL).fill().map(() => ({
            isWall: false, // 是否是墙壁
            isStart: false, // 是否是起点
            isGoal: false, // 是否是终点
            agent: -1, // 占用此格的代理编号
            color: "", // 代理对应的颜色
          }))
      ),
      // 存储所有代理的数组
      agents: [],
      numAgents: 0, // 当前代理的数量

      // 当前操作中添加代理的位置（起点和终点的行列索引）
      addedSRow: null,
      addedSCol: null,
      addedGRow: null,
      addedGCol: null,

      // UI 状态相关
      snackbarOpen: false, // 控制提示框是否打开
      isError: false, // 是否发生错误
      isMousePressed: false, // 当前鼠标是否被按下
      isPlanning: false, // 是否正在规划路径
      isPlanned: false, // 路径是否规划完成
      isAnimationFinished: false, // 动画是否结束
      planningTime: -1, // 路径规划耗时
      planningStatus: "", // 路径规划的状态（成功或失败）
      paths: [], // 路径数据

      // 对话框状态
      isInfoDialogOpen: true, // 信息对话框是否打开
      isDialogOpen: false, // 是否显示代理相关的对话框
      isAlgDialogOpen: false, // 是否展示算法配置对话框

      algorithmSummary: "", // 算法总结信息

      // 与代理添加相关的状态
      startToAdd: false, // 是否准备添加起点
      goalToAdd: false, // 是否准备添加终点
      colorToAdd: "", // 即将添加代理的颜色
      addedSRowClick: null, // 鼠标点击起点的行索引
      addedSColClick: null, // 鼠标点击起点的列索引
      toDelete: false, // 是否处于删除模式

      usedColors: new Set(), // 用于存储已生成的颜色，避免重复

      // 与当前任务配置相关的属性
      name: this.props.populate.name, // 当前任务的名称
      options: structuredClone(this.props.populate.options), // 配置选项
      description: this.props.populate.description, // 配置描述

      speed: 0.6, // 动画动作速率
    };
  }

  // 调整地图大小
  adjustMap(height, width, map) {
    this.setState({
      numRow: height, // 更新行的数量
      numCol: width, // 更新列的数量
      map: map, // 更新地图数据
      agents: [], // 清空代理数据
      numAgents: 0, // 重置代理数量
      startToAdd: false, // 关闭起点添加状态
      goalToAdd: false, // 关闭终点添加状态
      addedSRowClick: null, // 清空临时点击行
      addedSColClick: null, // 清空临时点击列
    });
  }

  // 设置动画速度
  setSpeed(speed) {
    switch (speed) {
      case "Slow":
        this.setState({ speed: 1 }); // 慢速动画
        break;
      case "Medium":
        this.setState({ speed: 0.6 }); // 中速动画（默认值）
        break;
      case "Fast":
        this.setState({ speed: 0.3 }); // 快速动画
        break;
    }
  }

  // React 生命周期方法，组件挂载时触发
  componentDidMount() {}

  // React 生命周期方法，组件卸载时触发
  componentWillUnmount() {}

  // 将二维地图的行列索引转换为线性索引值
  linearizeLocation(r, c) {
    return this.state.numCol * r + c;
  }

  // 将线性位置索引转换回二维地图的行列索引
  decodeLocation(loc) {
    return {
      r: Math.floor(loc / this.state.numCol), // 行索引
      c: loc % this.state.numCol, // 列索引
    };
  }

  // 创建一个空地图数据结构（指定行列数）
  createEmptyMap(row, col) {
    return new Array(row).fill().map(() =>
        new Array(col).fill().map(() => ({
          isWall: false, // 初始化为非墙壁
          isStart: false, // 初始化为非起点
          isGoal: false, // 初始化为非终点
          agent: -1, // 没有指定代理
          color: "", // 没有颜色
        }))
    );
  }

  // 发起路径规划请求
  async requestSolution(e) {
    e.preventDefault();

    // 如果没有添加任何代理，打开对话框提示用户操作
    if (this.state.agents.length === 0) {
      this.setState({ isDialogOpen: true });
      return;
    }

    // 检查是否完成代理终点的添加
    if (this.state.goalToAdd) return;

    // 设置规划状态为正在进行
    this.setState({ isPlanning: true });

    // 添加代理的边框样式
    this.state.agents.forEach((agent) => {
      var color = agent.color;
      document.getElementById(`grid-${agent.SR}-${agent.SC}`).style.border = `4px solid ${color}`;
      document.getElementById(`grid-${agent.GR}-${agent.GC}`).style.border = `4px solid ${color}`;
    });

    // 延迟 1 秒后处理（可视化效果）
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 收集地图中所有的墙壁信息
    var walls = [];
    var agents = [];
    this.state.map.forEach((row, rowId) => {
      row.forEach((grid, gridId) => {
        if (grid.isWall) {
          walls.push(this.linearizeLocation(rowId, gridId));
        }
      });
    });

    // 收集代理的起点和终点信息
    this.state.agents.forEach((agent) => {
      agents.push({
        startLoc: this.linearizeLocation(agent.SR, agent.SC), // 起点的线性位置
        goalLoc: this.linearizeLocation(agent.GR, agent.GC), // 终点的线性位置
      });
    });

    // 组织请求需要的数据
    var data = { row: this.state.numRow, col: this.state.numCol, walls: walls, agents: agents };

    // 将选项数据合并到请求数据中
    let options = this.state.options;
    for (let key in options) {
      data[key] =
          typeof options[key].options[0] === "number"
              ? options[key].value
              : options[key].options[options[key].value];
    }

    // 构造 POST 请求的选项
    const req = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    };

    // 发出请求并处理响应
    fetch(`${process.env.REACT_APP_URL}/${this.state.name}`, req)
        .then((response) => response.json()) // 解析响应为 JSON
        .then((data) => {
          // 更新状态
          this.setState(
              {
                isPlanning: false,
                isPlanned: true,
                algorithmSummary: data.algorithm, // 规划算法总结
                planningTime: data.time, // 规划耗时
                planningStatus: data.status, // 规划状态
                paths: data.paths, // 获取路径信息
              },
              () => {
                // 如果路径规划成功，播放动画
                if (data.status >= 0) {
                  this.playAnimation();
                }
              }
          );
        });
  }

  // 播放路径规划的动画
  playAnimation() {
    this.setState({ isAnimationFinished: false }); // 设置动画未完成

    var finishTime = 0; // 动画完成时间
    const paths = this.state.paths; // 获取代理路径数据

    // 检查所有路径的最长时长，以确定总动画时长
    for (var t = 0; t < paths.length; t++) {
      finishTime = Math.max(finishTime, paths[t].length);
    }

    // 逐步更新地图，模拟路径动画
    for (let t = 0; t < finishTime; t++) {
      setTimeout(() => {
        let map = this.state.map;

        // 重置地图单元格的状态
        for (let i = 0; i < map.length; i++) {
          for (let j = 0; j < map[i].length; j++) {
            map[i][j].isStart = false;
            map[i][j].agent = -1;
            map[i][j].color = "";
          }
        }

        // 更新代理的位置，模拟动画效果
        for (let i = 0; i < paths.length; i++) {
          let loc = this.decodeLocation(paths[i][paths[i].length > t ? t : paths[i].length - 1]);
          map[loc.r][loc.c].isStart = true; // 当前路径位置标记为起点
          map[loc.r][loc.c].agent = i + 1; // 标记当前为第 i+1 个代理
          map[loc.r][loc.c].color = this.state.agents[i].color; // 设置代理对应颜色
        }

        this.setState({ map: map }); // 更新地图状态
      }, 1000 * t * this.state.speed); // 根据速度调整每一步的延迟
    }

    // 动画完成后设置状态
    setTimeout(
        () => this.setState({ isAnimationFinished: true }),
        1000 * finishTime * this.state.speed // 按总时长计算
    );
  }

  // 修改地图行数
  changeMapRow(e) {
    let t = parseInt(e.target.value);
    t = t > 30 ? 30 : t < 4 ? 4 : t; // 行数的上下限为 4 到 30
    t = Math.min(t, this.state.numCol); // 确保不会超过列数
    this.setState({ tempRow: t }); // 设置临时行数
    this.adjustMap(t, this.state.numCol, this.createEmptyMap(t, this.state.numCol)); // 调整地图
  }

  // 修改地图列数
  changeMapCol(e) {
    let t = parseInt(e.target.value);
    t = t > 30 ? 30 : t < 4 ? 4 : t; // 列数的上下限为 4 到 30
    t = Math.max(t, this.state.numRow); // 确保不会小于行数
    this.setState({ tempCol: t }); // 设置临时列数
    this.adjustMap(this.state.numRow, t, this.createEmptyMap(this.state.numRow, t)); // 调整地图
  }
  // 处理通过表单添加代理
  handleAddAgent(e) {
    e.preventDefault(); // 阻止默认行为，如表单提交刷新页面
    // 检查输入的起点或终点是否超出地图边界
    const error =
        this.state.addedSRow >= this.state.numRow || // 起点行是否超过地图行数
        this.state.addedSRow < 0 || // 起点行是否小于 0
        this.state.addedSCol >= this.state.numCol || // 起点列是否超过地图列数
        this.state.addedSCol < 0 || // 起点列是否小于 0
        this.state.addedGRow >= this.state.numRow || // 终点行是否超过地图行数
        this.state.addedGRow < 0 || // 终点行是否小于 0
        this.state.addedGCol >= this.state.numCol || // 终点列是否超过地图列数
        this.state.addedGCol < 0; // 终点列是否小于 0

    if (error) return; // 如果有错误，直接返回
    this.addAgentToMap(); // 若无错误，调用函数完成代理添加
  }

// 用户在界面点击后添加代理
  handleAddAgentByClick() {
    // 生成一个随机的浅色半透明颜色作为代理颜色
    let color = randomColor({ luminosity: "light", alpha: 0.5 });
    // 如果颜色已被占用，循环生成直到找到未使用的颜色
    while (this.state.usedColors.has(color)) {
      color = randomColor({ luminosity: "light" });
    }
    // 将新颜色加入已使用颜色集合，避免重复
    this.setState({ usedColors: this.state.usedColors.add(color) });
    // 标记为正在添加起点，同时保存生成的颜色
    this.setState({ startToAdd: true, colorToAdd: color });
  }

// 添加代理到当前状态
  addAgent(color) {
    this.setState({
      // 增加代理计数
      numAgents: this.state.numAgents + 1,
      // 在代理数组中新增代理信息，包括起点、终点及颜色
      agents: [
        ...this.state.agents,
        {
          SR: this.state.addedSRow, // 起点行
          SC: this.state.addedSCol, // 起点列
          GR: this.state.addedGRow, // 终点行
          GC: this.state.addedGCol, // 终点列
          color: color, // 分配的随机颜色
        },
      ],
    });
  }

// 删除已经添加的代理
  removeAgent() {
    this.setState({ toDelete: true }); // 开启删除模式
  }

// 显示提示框（如颜色指示），并完成代理添加
  showSnackbar(color) {
    if (!this.state.isError) this.addAgent(color); // 如果未发生错误，添加代理
    this.setState({ snackbarOpen: true }); // 打开提示框
    setTimeout(() => this.setState({ isError: false }), 1200); // 1.2 秒后关闭错误标记
    this.emptyForm(); // 清空表单
  }

// 关闭提示框
  handleCloseSnackbar(event, reason) {
    // 如果因用户点击屏幕其他地方触发关闭，不处理
    if (reason === "clickaway") {
      return;
    }
    this.setState({ snackbarOpen: false }); // 否则，关闭提示框
  }

// 将代理的起点和终点添加到地图
  addAgentToMap() {
    const color = randomColor(); // 生成代理颜色
    var newMap = structuredClone(this.state.map); // 深拷贝当前地图以防止状态污染
    var i = this.state.addedSRow; // 起点行
    var j = this.state.addedSCol; // 起点列

    // 如果起点位置被占用或是墙，则设置错误并退出
    if (newMap[i][j].agent !== -1 || newMap[i][j].isWall) {
      this.setState({ isError: true }, () => this.showSnackbar(color));
      return;
    }
    // 设置起点状态
    newMap[i][j].agent = this.state.numAgents + 1;
    newMap[i][j].isStart = true;
    newMap[i][j].color = color;

    i = this.state.addedGRow; // 终点行
    j = this.state.addedGCol; // 终点列

    // 如果终点位置被占用或是墙，则设置错误并退出
    if (newMap[i][j].agent !== -1 || newMap[i][j].isWall) {
      this.setState({ isError: true }, () => this.showSnackbar(color));
      return;
    }
    // 设置终点状态
    newMap[i][j].agent = this.state.numAgents + 1;
    newMap[i][j].isGoal = true;
    newMap[i][j].color = color;

    // 更新地图状态，并显示成功提示
    this.setState({ map: newMap }, () => this.showSnackbar(color));
  }

// 清空输入表单数据
  emptyForm() {
    this.setState({
      addedSRow: null, // 清空起点行
      addedSCol: null, // 清空起点列
      addedGRow: null, // 清空终点行
      addedGCol: null, // 清空终点列
    });
  }

// 鼠标按下时的处理逻辑
  handleMouseDown(row, col) {
    // 如果处于删除模式
    if (this.state.toDelete) {
      let agentToDelete = this.state.map[row][col].agent; // 获取当前单元格上的代理编号
      let agents = this.state.agents; // 获取现有代理数组
      agents.splice(agentToDelete - 1, 1); // 移除对应编号的代理
      let map = this.state.map; // 获取当前地图状态

      // 清空地图中所有代理痕迹
      for (let i = 0; i < map.length; i++) {
        for (let j = 0; j < map[i].length; j++) {
          if (!map[i][j].isWall) {
            map[i][j].isStart = false;
            map[i][j].isGoal = false;
            map[i][j].agent = -1;
            map[i][j].color = "";
          }
        }
      }

      // 根据剩余的代理重新标记地图
      for (let i = 0; i < agents.length; i++) {
        let agent = agents[i];
        map[agent.SR][agent.SC].isStart = true;
        map[agent.SR][agent.SC].agent = i + 1;
        map[agent.SR][agent.SC].color = agent.color;
        map[agent.GR][agent.GC].isGoal = true;
        map[agent.GR][agent.GC].agent = i + 1;
        map[agent.GR][agent.GC].color = agent.color;
      }

      // 更新状态（包括地图、代理数组、删除模式关闭）
      this.setState({ map: map, agents: agents, numAgents: agents.length, toDelete: false });
    }
    // 如果当前正在添加代理的起点
    else if (this.state.startToAdd) {
      // 确保位置未被占用且不是墙
      if (!this.state.map[row][col].isWall && this.state.map[row][col].agent === -1) {
        var map = this.state.map; // 获取当前地图状态
        map[row][col].agent = this.state.numAgents + 1;
        map[row][col].isStart = true;
        map[row][col].color = this.state.colorToAdd; // 设置颜色
        this.setState({
          startToAdd: false, // 停止起点添加
          goalToAdd: true, // 开启终点添加
          addedSRowClick: row, // 记录起点行索引
          addedSColClick: col, // 记录起点列索引
          map: map, // 更新地图
        });
      }
    }
    // 如果当前正在添加代理的终点
    else if (this.state.goalToAdd) {
      // 确保位置未被占用且不是墙
      if (!this.state.map[row][col].isWall && this.state.map[row][col].agent === -1) {
        var map = this.state.map; // 获取当前地图
        map[row][col].agent = this.state.numAgents + 1;
        map[row][col].isGoal = true;
        map[row][col].color = this.state.colorToAdd; // 设置颜色
        this.setState({
          goalToAdd: false, // 停止终点添加
          addedSRowClick: null, // 清空起点行索引
          addedSColClick: null, // 清空起点列索引
          colorToAdd: "", // 清空颜色
          numAgents: this.state.numAgents + 1, // 更新代理数量
          map: map, // 更新地图
          agents: [
            ...this.state.agents,
            {
              SR: this.state.addedSRowClick, // 起点行
              SC: this.state.addedSColClick, // 起点列
              GR: row, // 终点行
              GC: col, // 终点列
              color: this.state.colorToAdd, // 颜色
            },
          ], // 更新代理数组
        });
      }
    } else {
      // 如果未处于添加或删除状态，通过拖动更新墙或路径
      this.setState({ isMousePressed: true }, () => this.updateWall(row, col));
    }
  }

// 鼠标移动时，当处于拖动状态时更新墙
  handleMouseEnter(row, col) {
    if (this.state.isMousePressed) {
      this.updateWall(row, col);
    }
  }

// 鼠标抬起时，停止拖动状态
  handleMouseUp() {
    this.setState({ isMousePressed: false });
  }

// 更新地图上的墙
  updateWall(row, col) {
    // 仅当网格未被代理占用且当前未处于规划状态时，允许更改墙
    if (this.state.map[row][col].agent === -1 && !this.state.isPlanning && !this.state.isPlanned) {
      var newMap = this.state.map.slice(); // 创建地图副本
      newMap[row][col] = {
        ...newMap[row][col],
        isWall: !newMap[row][col].isWall, // 切换墙的状态
      };
      this.setState({ map: newMap }); // 更新地图状态
    }
  }

// 开始新任务，重置所有状态和地图
  startNewTask() {
    this.setState(
        {
          numRow: DEFAULTROW,
          numCol: DEFAULTCOL,
          tempRow: DEFAULTROW,
          tempCol: DEFAULTCOL,
          map: this.createEmptyMap(DEFAULTROW, DEFAULTCOL),
          agents: [],
          numAgents: 0,
          addedSRow: null,
          addedSCol: null,
          addedGRow: null,
          addedGCol: null,
          snackbarOpen: false,
          isError: false,
          isMousePressed: false,
          isPlanning: false,
          isPlanned: false,
          isAnimationFinished: false,
          planningTime: -1,
          planningStatus: "",
          paths: [],
          options: structuredClone(this.props.populate.options),
          algorithmSummary: "",
          startToAdd: false,
          goalToAdd: false,
          speed: 0.6,
        },
        () => {
          // 重置地图上的可视化样式
          for (let i = 0; i < DEFAULTROW; i++) {
            for (let j = 0; j < DEFAULTCOL; j++) {
              document.getElementById(`grid-${i}-${j}`).style.backgroundColor = "";
              document.getElementById(`grid-${i}-${j}`).style.border = "";
            }
          }
        }
    );
  }

// 填充任务描述内容
  populateDescription() {
    return (
        <MKBox px={6} py={3} textAlign="left">
          {this.state.description.map((description, i) => {
            return (
                <MKTypography component="div" variant="body2" mb={1} key={i}>
                  <div dangerouslySetInnerHTML={{ __html: i + 1 + ". " + description }} />
                </MKTypography>
            );
          })}
        </MKBox>
    );
  }

// 根据选项渲染动态表单（滑块、开关、单选框）
  populateOptions() {
    var options = [];
    for (let key in this.state.options) {
      let option = this.state.options[key];
      let sliderDisplay = true;

      // 检查是否存在选项限制
      if (option.hasOwnProperty("restrictions")) {
        for (let key2 in option.restrictions) {
          option.restrictions[key2].forEach((restriction) => {
            if (this.state.options[key2].value === restriction) {
              sliderDisplay = false;
            }
          });
        }
      }

      // 渲染对应的选项控件（如开关、滑块、单选框）
      options.push(
          option.options[0] === false ? (
              // 布尔值：开关
              <MKBox px={2} key={key}>
                <Grid container>
                  <Grid item container xs={12} md={5} alignItems="center">
                    <MKTypography variant="h6">{option.name}</MKTypography>
                  </Grid>
                  <Grid item container xs={12} md={7} alignItems="center">
                    <Switch
                        checked={!!option.value}
                        onChange={(e) => {
                          if (option.hasOwnProperty("restrictions")) {
                            let check = false;
                            for (let key2 in option.restrictions) {
                              option.restrictions[key2].forEach((restriction) => {
                                if (this.state.options[key2].value === restriction) {
                                  check = true;
                                }
                              });
                            }
                            if (!check) {
                              option.value = Number(e.target.checked);
                              this.setState({});
                            }
                          } else {
                            option.value = Number(e.target.checked);
                            this.setState({});
                          }
                        }}
                    />
                  </Grid>
                </Grid>
              </MKBox>
          ) : typeof option.options[0] === "number" ? (
              sliderDisplay ? (
                  // 数字范围：滑块
                  <MKBox px={2} key={key}>
                    <Grid container justifyContent="center">
                      <Grid item container xs={12} md={11} alignItems="center">
                        <Slider
                            step={0.001}
                            min={option.options[0]}
                            max={option.options[1]}
                            valueLabelDisplay="auto"
                            value={option.value}
                            onChange={(e) => {
                              option.value = Number(e.target.value);
                              this.setState({});
                            }}
                        />
                      </Grid>
                    </Grid>
                  </MKBox>
              ) : (
                  ""
              )
          ) : (
              // 单选框
              <MKBox px={2} key={key}>
                <MKTypography variant="h6">{option.name}</MKTypography>
                <RadioGroup
                    row
                    value={option.value}
                    onChange={(e) => {
                      option.value = Number(e.target.value);
                      this.setState({});
                      if (option.hasOwnProperty("control")) {
                        for (let key2 in option.control) {
                          option.control[key2].forEach((control) => {
                            if (Number(e.target.value) === control) {
                              this.state.options[key2].value = 0;
                              this.setState({});
                            }
                          });
                        }
                      }
                    }}
                >
                  {option.options.map((opt, id) => {
                    return <FormControlLabel key={id} value={id} control={<Radio />} label={opt} />;
                  })}
                </RadioGroup>
              </MKBox>
          )
      );
    }
    return options;
  }

// 检查行是否超出范围
  checkRowOOR() {
    return (
        this.state.addedSRow + 1 > this.state.numRow || this.state.addedGRow + 1 > this.state.numRow
    );
  }

// 检查列是否超出范围
  checkColOOR() {
    return (
        this.state.addedSCol + 1 > this.state.numCol || this.state.addedGCol + 1 > this.state.numCol
    );
  }
  render() {
    return (
        <BaseLayout title="Classic MAPF">
          {/* ### 信息提示对话框 ### */}
          <MKBox component="section">
            <Modal
                open={this.state.isInfoDialogOpen} // 是否打开信息提示对话框
                onClose={() => {
                  this.setState({ isInfoDialogOpen: false }); // 关闭对话框
                }}
                sx={{ display: "grid", placeItems: "center" }} // 对话框整体居中
            >
              <Slide direction="down" in={this.state.isInfoDialogOpen} timeout={500}>
                <MKBox
                    position="relative"
                    width="50vw" // 对话框宽度设为窗口宽度的 50%
                    display="flex"
                    flexDirection="column"
                    borderRadius="xl"
                    variant="gradient"
                    shadow="sm"
                >
                  {/* 对话框顶部标题 */}
                  <MKBox display="flex" alginItems="center" justifyContent="center" p={2}>
                    <MKTypography variant="h4">A few things to know</MKTypography>
                  </MKBox>
                  <Divider sx={{ my: 0 }} />
                  {/* 填充描述内容（动态生成） */}
                  {this.populateDescription()}
                  <Divider light sx={{ my: 0 }} />
                  {/* 确认关闭按钮 */}
                  <MKBox display="flex" justifyContent="right" py={1} px={1.5}>
                    <MKButton onClick={() => this.setState({ isInfoDialogOpen: false })}>
                      ok, got it
                    </MKButton>
                  </MKBox>
                </MKBox>
              </Slide>
            </Modal>
          </MKBox>
          {/* ### 空代理提示对话框 ### */}
          <MKBox component="section">
            <Modal
                open={this.state.isDialogOpen} // 是否显示空代理对话框
                onClose={() => {
                  this.setState({ isDialogOpen: false });
                }}
                sx={{ display: "grid", placeItems: "center" }}
            >
              <Slide direction="down" in={this.state.isDialogOpen} timeout={500}>
                <MKBox
                    position="relative"
                    width="fit-content"
                    display="flex"
                    flexDirection="column"
                    borderRadius="xl"
                    variant="gradient"
                    shadow="sm"
                >
                  {/* 对话框内容 */}
                  <MKBox p={3} textAlign="center">
                    <MKTypography variant="h4" mt={1} mb={1}>
                      Empty agent list
                    </MKTypography>
                    <MKTypography variant="body2">
                      Please add at least one agent before starting planning.
                    </MKTypography>
                  </MKBox>
                  <Divider light sx={{ my: 0 }} />
                  <MKBox display="flex" justifyContent="right" py={1} px={1.5}>
                    {/* 确认关闭按钮 */}
                    <MKButton onClick={() => this.setState({ isDialogOpen: false })}>
                      ok, got it
                    </MKButton>
                  </MKBox>
                </MKBox>
              </Slide>
            </Modal>
          </MKBox>
          {/* ### 2D 网格地图和右侧面板 ### */}
          <Grid container className="body" px={4} sx={{ WebkitUserDrag: "none" }}>
            {/* #### 左侧网格地图 (2D Map) #### */}
            <Grid
                item
                container
                xs={12} // 移动端宽度占 12 列
                md={8} // 桌面端宽度占 8 列
                direction="row"
                justifyContent="center"
                alignItems="center"
                sx={{ WebkitUserDrag: "none" }} // 禁止用户拖动
            >
              {/* 地图中的所有网格（动态生成） */}
              <Grid container id="map" sx={{ WebkitUserDrag: "none" }}>
                {/* 绘制列标题 */}
                <Grid
                    item
                    container
                    justifyContent="center"
                    columns={this.state.numCol >= 12 ? this.state.numCol + 1 : 12}
                >
                  {Array.from("x".repeat(this.state.numCol + 1)).map((a, id) => {
                    return <SingleGrid key={id} row={id - 1} col={-1} />;
                  })}
                </Grid>
                {/* 绘制地图每一行 */}
                {this.state.map.map((row, rowId) => {
                  return (
                      <Grid
                          item
                          container
                          justifyContent="center"
                          key={rowId}
                          columns={this.state.numCol >= 12 ? this.state.numCol + 1 : 12}
                          sx={{ WebkitWebkitUserDrag: "none" }}
                      >
                        {/* 行标题 */}
                        <SingleGrid row={rowId} col={-1} />
                        {/* 绘制地图中的每一个单元格 */}
                        {row.map((grid, gridId) => {
                          return (
                              <SingleGrid
                                  key={gridId}
                                  row={rowId}
                                  col={gridId}
                                  isWall={grid.isWall} // 是否为墙
                                  isStart={grid.isStart} // 是否为起点
                                  isGoal={grid.isGoal} // 是否为终点
                                  agentId={grid.agent} // 当前智能体ID
                                  color={grid.color} // 智能体颜色
                                  isPlanned={this.state.isPlanned} // 是否已规划完成
                                  onMouseDown={(row, col) => this.handleMouseDown(row, col)} // 鼠标按下事件
                                  onMouseEnter={(row, col) => this.handleMouseEnter(row, col)} // 鼠标滑过事件
                                  onMouseUp={(row, col) => this.handleMouseUp(row, col)} // 鼠标抬起事件
                                  sx={{ WebkitUserDrag: "none" }}
                              />
                          );
                        })}
                      </Grid>
                  );
                })}
              </Grid>
            </Grid>
            {/* #### 右侧操作面板 #### */}
            <Grid
                item
                container
                xs={12}
                md={4} // 桌面端宽度占 4 列
                style={{
                  display: "inline-block",
                }}
            >
              <div>
                {/* 是否处于规划中 (加载动画显示) */}
                {this.state.isPlanning ? (
                    <LoadingAnimation />
                ) : this.state.isPlanned ? (
                    // 规划完成后显示结果
                    <PlanningResult
                        algorithm={this.state.algorithmSummary}
                        status={this.state.planningStatus}
                        planningTime={this.state.planningTime}
                        paths={this.state.paths}
                        numCol={this.state.numCol}
                        startNew={() => this.startNewTask()} // 新任务
                        replay={() => this.playAnimation()} // 重放动画
                        isDisabled={!this.state.isAnimationFinished} // 动画未完成时禁用按钮
                        speed={
                          this.state.speed === 1 ? "Slow" : this.state.speed === 0.6 ? "Medium" : "Fast"
                        } // 显示速度
                        setSpeed={(speed) => this.setSpeed(speed)} // 修改速度
                        agents={this.state.agents} // 当前智能体列表
                    ></PlanningResult>
                ) : (
                    // 默认显示用户可调控的表单和功能按钮
                    <MKBox component="section" py={2}>
                      <Container>
                        {/* 算法部分：选择技术 */}
                        <Grid
                            container
                            justifyContent="center"
                            textAlign="center"
                        >
                          <MKTypography variant="h3" mb={1}>
                            Algorithm
                          </MKTypography>
                        </Grid>
                        <Grid container>
                          <MKButton
                              variant="outlined"
                              onClick={() => this.setState({ isAlgDialogOpen: true })}
                              fullWidth
                              color="info"
                          >
                            Choose reasoning techniques
                          </MKButton>
                        </Grid>
                        {/* 弹窗设置算法改进技术 */}
                        <Modal
                            open={this.state.isAlgDialogOpen}
                            onClose={() => this.setState({ isAlgDialogOpen: false })}
                        >
                          <MKBox>
                            {this.populateOptions()} {/* 显示算法选项 */}
                          </MKBox>
                        </Modal>
                        {/* 地图信息修改 */}
                        <MKTypography variant="h3">Map info</MKTypography>
                        <MKInput label="Rows" onChange={(e) => {/*...*/}} />
                        <MKInput label="Columns" onChange={(e) => {/*...*/}} />
                        {/* 操作代理 */}
                        <MKButton onClick={() => {/* 添加 */}}>Add</MKButton>
                        <MKButton onClick={() => {/* 删除 */}}>Remove</MKButton>
                      </Container>
                    </MKBox>
                )}
              </div>
            </Grid>
          </Grid>
        </BaseLayout>
    );
  }
}
export default MAPFVisualizer;

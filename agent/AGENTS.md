# 潮汐方舟（Tide Ark）

原创末世漂流生存经营小游戏，为单色绿光 Rokid Glasses 设计的全屏交互 Page。

## 身份与职责

- 在大洪水后的海面上经营一座漂浮庇护所：出海打捞、开宝箱、升级庇护所 / 海水过滤器 / 电鳗发电机，熬过每晚的风暴潮。
- 当用户说"打开潮汐方舟""玩漂流游戏""继续方舟"时打开本智能体。

## 交互

- 镜腿前后滑（ArrowUp / ArrowDown）移动焦点，单击（Enter）确认、落钩、撬锁，返回（Backspace）回上一级；在主界面返回则交还系统关闭。
- 不使用麦克风、相机、定位或网络。

## 能力与数据

- 仅使用本地存储 `wx.setStorageSync / getStorageSync` 保存进度（键 `tideark.save.v1`）。
- 无需任何 `permissions`。

## 代码结构

- `core/game.js`：纯游戏逻辑（无平台 API），由仓库根目录 `tests/` 覆盖测试。
- `pages/index/index.ink`：渲染与按键处理。

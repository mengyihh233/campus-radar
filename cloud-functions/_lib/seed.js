/**
 * _lib/seed.js — 内置模拟校园信息（服务端播种用）
 *
 * ⚠️ 本文件由 tools/gen-seed.mjs 自动生成，请勿手工编辑。
 * 数据源：src/data/activities.js
 */

export const SEED_VERSION = 1;

/** 内置信息的数据基准日，用于生成 createdAt */
export const SEED_BASE_TIME = new Date('2026-09-19T08:00:00').getTime();

export const SEED_ACTIVITIES = [
  {
    "id": "01",
    "title": "“蓝桥杯”程序设计校内训练营",
    "source": "school",
    "category": "competition",
    "summary": "面向全校的算法竞赛训练营，零基础可参加，报名截止 9月24日 22:00。",
    "start": "2026-09-21T19:30",
    "end": null,
    "recurrence": "每周一次训练，首次为 9月21日 19:30",
    "place": "实验楼 A402",
    "deadline": "2026-09-24T22:00",
    "deadlineText": "9月24日 22:00 报名截止",
    "audience": "all",
    "audienceText": "面向全校学生",
    "requirement": "零基础可参加",
    "commitment": "每周一次训练",
    "notices": [
      {
        "tone": "warn",
        "text": "首次训练（9月21日）早于报名截止（9月24日）。如需参加，建议尽早向组织方确认是否接受中途加入。"
      }
    ],
    "missing": [],
    "riskLevel": null,
    "riskFlags": [],
    "supersedes": null,
    "supersededBy": "09",
    "changeLog": [
      "首次训练时间：9月20日 → 9月21日 19:30（因场地调整）",
      "训练地点明确为「实验楼 A402」",
      "报名截止 9月24日 22:00 保持不变",
      "已报名的同学无需重复提交"
    ],
    "isNotice": false,
    "addedAt": 1,
    "raw": "9月24日22:00报名截止；原计划9月20日起每周六19:00训练；面向全校学生；零基础可参加。（据 09 号补充通知更新）"
  },
  {
    "id": "02",
    "title": "AI应用入门公开课",
    "source": "school",
    "category": "lecture",
    "summary": "今晚 19:00 开讲，无需报名，预计 90 分钟。",
    "start": "2026-09-19T19:00",
    "end": "2026-09-19T20:30",
    "place": "计算机学院教学楼",
    "deadline": null,
    "deadlineText": "无需报名，直接前往",
    "audience": "all",
    "audienceText": "面向全校学生",
    "requirement": "无需报名",
    "notices": [],
    "missing": [
      "具体教室"
    ],
    "riskLevel": null,
    "riskFlags": [],
    "isNotice": false,
    "addedAt": 2,
    "raw": "9月19日19:00；计算机学院教学楼；面向全校学生；无需报名；预计90分钟"
  },
  {
    "id": "03",
    "title": "大学生创新创业项目团队招募",
    "source": "school",
    "category": "recruit",
    "summary": "招募开发、设计、材料三类成员，每周需稳定投入 4 小时以上。",
    "start": null,
    "end": null,
    "recurrence": "项目周期内持续参与",
    "place": "",
    "deadline": "2026-09-22T18:00",
    "deadlineText": "9月22日 18:00 报名截止",
    "audience": "all",
    "audienceText": "面向全校学生",
    "requirement": "需提交简短自我介绍；每周需稳定投入 4 小时以上",
    "commitment": "每周 ≥ 4 小时",
    "roles": [
      "开发",
      "设计",
      "材料"
    ],
    "notices": [
      {
        "tone": "teal",
        "text": "本条已被 20 号补充说明更新：开发方向名额已满，目前主要补充「设计」「材料」成员。"
      }
    ],
    "missing": [],
    "riskLevel": null,
    "riskFlags": [],
    "supersededBy": "20",
    "changeLog": [
      "开发方向名额已满，改为主要补充「设计」「材料」成员",
      "报名截止仍为 9月22日 18:00",
      "此前已投递者无需重复提交"
    ],
    "isNotice": false,
    "addedAt": 3,
    "raw": "招募开发、设计、材料成员；每周需稳定投入4小时以上；9月22日18:00截止；需提交简短自我介绍。（据 20 号补充说明更新）"
  },
  {
    "id": "04",
    "title": "数学建模竞赛经验分享会",
    "source": "school",
    "category": "lecture",
    "summary": "直播已于 9月18日 19:30 结束，活动方预计 9月20日 上传回放。",
    "start": "2026-09-18T19:30",
    "end": null,
    "recurrence": null,
    "place": "线上直播",
    "deadline": null,
    "deadlineText": "直播已结束",
    "audience": "all",
    "audienceText": "不限专业",
    "requirement": "无需报名",
    "replayAt": "2026-09-20",
    "notices": [
      {
        "tone": "info",
        "text": "直播已结束。回放预计 9月20日 上传，届时需要活动方另外提供回放地址。"
      }
    ],
    "missing": [
      "回放地址",
      "直播时长"
    ],
    "riskLevel": null,
    "riskFlags": [],
    "isNotice": false,
    "addedAt": 4,
    "raw": "直播时间为9月18日19:30；不限专业；直播已结束，活动方预计9月20日上传回放"
  },
  {
    "id": "05",
    "title": "校园公益志愿服务活动",
    "source": "school",
    "category": "volunteer",
    "summary": "9月27日 8:30—17:00 全天志愿服务，预计 8 小时，报名 9月20日 12:00 截止。",
    "start": "2026-09-27T08:30",
    "end": "2026-09-27T17:00",
    "place": "",
    "deadline": "2026-09-20T12:00",
    "deadlineText": "9月20日 12:00 报名截止",
    "audience": "all",
    "audienceText": "面向全校学生",
    "requirement": "需提前到场签到",
    "commitment": "预计服务 8 小时（全天）",
    "notices": [
      {
        "tone": "warn",
        "text": "需提前到场签到，报名截止（9月20日 12:00）距活动开始仍有 7 天，请留意后续通知。"
      }
    ],
    "missing": [
      "集合地点",
      "报名方式"
    ],
    "riskLevel": null,
    "riskFlags": [],
    "isNotice": false,
    "addedAt": 5,
    "raw": "活动时间9月27日8:30—17:00；9月20日12:00报名截止；预计服务8小时；需提前到场签到"
  },
  {
    "id": "06",
    "title": "Web开发零基础学习小组",
    "source": "school",
    "category": "study",
    "summary": "9月23日起每周三 19:30，共 6 周，限 30 人，满员即止。",
    "start": "2026-09-23T19:30",
    "end": null,
    "recurrence": "每周三 19:30，共 6 周",
    "place": "",
    "deadline": null,
    "deadlineText": "报名时间未注明，满员即止",
    "capacity": 30,
    "capacityText": "限 30 人",
    "audience": "all",
    "audienceText": "面向零基础学生",
    "requirement": "零基础可参加",
    "commitment": "每周三 19:30，共 6 周",
    "notices": [
      {
        "tone": "warn",
        "text": "材料未给出报名截止时间，仅说明「满员即止」。如感兴趣建议尽早联系组织方，避免名额被占满。"
      }
    ],
    "missing": [
      "报名截止时间",
      "报名方式",
      "活动地点"
    ],
    "riskLevel": "warn",
    "riskFlags": [
      "未注明报名截止时间"
    ],
    "isNotice": false,
    "addedAt": 6,
    "raw": "9月23日起每周三19:30开展，共6周；面向零基础学生；限30人；报名时间未注明，满员即止"
  },
  {
    "id": "07",
    "title": "AI创新应用挑战赛",
    "source": "school",
    "category": "competition",
    "summary": "2—4 人组队，9月21日 18:00 前完成校内意向登记，10月20日 提交作品。",
    "start": null,
    "end": null,
    "recurrence": null,
    "place": "",
    "deadline": "2026-09-21T18:00",
    "deadlineText": "9月21日 18:00 校内意向登记截止",
    "audience": "all",
    "audienceText": "面向全校学生",
    "requirement": "2—4 人组队",
    "commitment": "至 10月20日 提交作品",
    "milestones": [
      {
        "label": "校内意向登记截止",
        "at": "2026-09-21T18:00"
      },
      {
        "label": "作品提交截止",
        "at": "2026-10-20T23:59"
      }
    ],
    "notices": [
      {
        "tone": "warn",
        "text": "意向登记不等同于最终作品提交，两个环节需要分别完成，切勿只登记就以为已经参赛。"
      }
    ],
    "missing": [
      "赛题方向"
    ],
    "riskLevel": null,
    "riskFlags": [],
    "isNotice": false,
    "addedAt": 7,
    "raw": "2—4人组队；9月21日18:00前完成校内意向登记；10月20日提交作品；意向登记不等同于最终作品提交"
  },
  {
    "id": "08",
    "title": "校园软件项目组招募",
    "source": "school",
    "category": "recruit",
    "summary": "开发校园实用工具，面向大一、大二，希望成员了解 Git 基本操作，长期招募。",
    "start": null,
    "end": null,
    "recurrence": "长期",
    "place": "",
    "deadline": null,
    "deadlineText": "长期招募，满员即止",
    "audience": "freshman_soph",
    "audienceText": "面向大一、大二学生",
    "requirement": "希望成员了解 Git 基本操作",
    "commitment": "每周预计投入 5 小时",
    "notices": [
      {
        "tone": "info",
        "text": "材料提到「希望了解 Git 基本操作」——这是软性期望而非硬性门槛，零基础也可以先接触再补。"
      }
    ],
    "missing": [
      "报名方式"
    ],
    "riskLevel": null,
    "riskFlags": [],
    "isNotice": false,
    "addedAt": 8,
    "raw": "开发校园实用工具；面向大一、大二学生；希望成员了解Git基本操作；每周预计投入5小时；长期招募，满员即止"
  },
  {
    "id": "09",
    "title": "程序设计训练营补充通知",
    "source": "school",
    "category": "other",
    "summary": "对 01 号训练营的补充：调整首次训练时间与地点。",
    "start": "2026-09-21T19:30",
    "end": null,
    "place": "实验楼 A402",
    "deadline": "2026-09-24T22:00",
    "deadlineText": "报名截止时间不变（9月24日 22:00）",
    "audience": "all",
    "audienceText": "面向全校学生",
    "requirement": "",
    "isNotice": true,
    "supersedes": "01",
    "notices": [
      {
        "tone": "teal",
        "text": "本条是对「蓝桥杯程序设计校内训练营」的修订，已自动合并到 01 号信息中。"
      }
    ],
    "missing": [],
    "riskLevel": null,
    "riskFlags": [],
    "addedAt": 9,
    "raw": "因场地调整，首次训练改为9月21日19:30，地点改至实验楼A402；已报名同学无需重复提交；报名截止时间不变"
  },
  {
    "id": "10",
    "title": "前端开发经验交流会",
    "source": "school",
    "category": "lecture",
    "summary": "9月19日 15:00—16:30，线下 A201，同步线上直播，无需报名。",
    "start": "2026-09-19T15:00",
    "end": "2026-09-19T16:30",
    "place": "线下 A201（同步线上直播）",
    "deadline": null,
    "deadlineText": "无需报名，直接前往",
    "audience": "all",
    "audienceText": "面向全校学生",
    "requirement": "无需报名",
    "notices": [],
    "missing": [
      "直播入口"
    ],
    "riskLevel": null,
    "riskFlags": [],
    "isNotice": false,
    "addedAt": 10,
    "raw": "9月19日15:00—16:30；线下A201并同步线上直播；无需报名"
  },
  {
    "id": "11",
    "title": "大学生科研入门分享会",
    "source": "school",
    "category": "lecture",
    "summary": "9月21日 19:00—20:30，介绍论文检索、学生科研项目与导师联系方法。",
    "start": "2026-09-21T19:00",
    "end": "2026-09-21T20:30",
    "place": "",
    "deadline": null,
    "deadlineText": "面向全校学生，未说明是否需报名",
    "audience": "all",
    "audienceText": "面向全校学生",
    "requirement": "",
    "notices": [],
    "missing": [
      "活动地点",
      "是否需报名"
    ],
    "riskLevel": null,
    "riskFlags": [],
    "isNotice": false,
    "addedAt": 11,
    "raw": "9月21日19:00—20:30；介绍论文检索、学生科研项目和导师联系方法；面向全校学生"
  },
  {
    "id": "12",
    "title": "全国高校计算机能力挑战赛",
    "source": "school",
    "category": "competition",
    "summary": "面向本科生，个人参赛，10月5日 23:59 报名截止，费用信息未提供。",
    "start": null,
    "end": null,
    "recurrence": null,
    "place": "",
    "deadline": "2026-10-05T23:59",
    "deadlineText": "10月5日 23:59 报名截止",
    "audience": "undergrad",
    "audienceText": "面向本科生",
    "requirement": "个人参赛",
    "notices": [
      {
        "tone": "warn",
        "text": "材料明确说明「具体费用信息未提供」。报名前请先向赛事方确认费用与比赛形式，再做决定。"
      }
    ],
    "missing": [
      "参赛费用",
      "比赛形式",
      "报名方式"
    ],
    "riskLevel": "warn",
    "riskFlags": [
      "未提供参赛费用信息"
    ],
    "isNotice": false,
    "addedAt": 12,
    "raw": "面向本科生；10月5日23:59报名截止；个人参赛；具体费用信息未提供"
  },
  {
    "id": "13",
    "title": "科研助理招募",
    "source": "school",
    "category": "recruit",
    "summary": "协助数据整理与实验工作，仅限大二及以上，9月21日 截止报名。",
    "start": null,
    "end": null,
    "recurrence": "岗位长期",
    "place": "",
    "deadline": "2026-09-21T23:59",
    "deadlineText": "9月21日 截止（材料未注明具体时刻，按当日 23:59 计）",
    "audience": "sophomore_plus",
    "audienceText": "仅限大二及以上学生",
    "requirement": "大二及以上在读",
    "commitment": "每周预计投入 6 小时",
    "notices": [
      {
        "tone": "warn",
        "text": "本条仅面向大二及以上学生。大一新生暂不符合报名条件，可以先记下，等升入大二后再关注类似岗位。"
      }
    ],
    "missing": [
      "报名截止具体时刻",
      "报名方式"
    ],
    "riskLevel": null,
    "riskFlags": [],
    "isNotice": false,
    "addedAt": 13,
    "raw": "协助数据整理和实验工作；仅限大二及以上学生；每周预计投入6小时；9月21日截止报名"
  },
  {
    "id": "14",
    "title": "Git与GitHub零基础工作坊",
    "source": "school",
    "category": "study",
    "summary": "9月21日 19:00—20:30，主要面向大一新生，限 40 人，需提前预约。",
    "start": "2026-09-21T19:00",
    "end": "2026-09-21T20:30",
    "place": "",
    "deadline": null,
    "deadlineText": "需提前预约（材料未注明预约截止时间）",
    "capacity": 40,
    "capacityText": "限 40 人",
    "audience": "freshman",
    "audienceText": "主要面向大一新生",
    "requirement": "零基础可参加；需提前预约",
    "notices": [
      {
        "tone": "warn",
        "text": "提交报名表不代表最终录取，以审核通知为准。提交后请留意后续通知，不要默认已经入选。"
      }
    ],
    "missing": [
      "活动地点",
      "预约截止时间",
      "报名入口"
    ],
    "riskLevel": "warn",
    "riskFlags": [
      "提交报名表不代表最终录取"
    ],
    "isNotice": false,
    "addedAt": 14,
    "raw": "9月21日19:00—20:30；主要面向大一新生；限40人；需提前预约，提交报名表不代表最终录取，以审核通知为准"
  },
  {
    "id": "15",
    "title": "AI应用创意挑战",
    "source": "school",
    "category": "competition",
    "summary": "9月23日 23:59 前提交创意方案，9月30日前提交最终作品，可个人或团队。",
    "start": null,
    "end": null,
    "recurrence": null,
    "place": "",
    "deadline": "2026-09-23T23:59",
    "deadlineText": "9月23日 23:59 创意方案提交截止",
    "audience": "all",
    "audienceText": "面向全校学生",
    "requirement": "允许个人或团队参加",
    "milestones": [
      {
        "label": "创意方案提交截止",
        "at": "2026-09-23T23:59"
      },
      {
        "label": "最终作品提交截止",
        "at": "2026-09-30T23:59"
      }
    ],
    "notices": [
      {
        "tone": "info",
        "text": "进入展示环节后仍可再组队，因此可以先以个人身份报名，不组队也能参加。"
      }
    ],
    "missing": [
      "作品要求",
      "提交方式"
    ],
    "riskLevel": null,
    "riskFlags": [],
    "isNotice": false,
    "addedAt": 15,
    "raw": "9月23日23:59前提交创意方案；9月30日前提交最终作品；允许个人或团队参加；进入展示环节后可再组队"
  },
  {
    "id": "16",
    "title": "校园摄影志愿者招募",
    "source": "school",
    "category": "volunteer",
    "summary": "长期招募，参与校内大型活动摄影，有设备者优先但非硬性要求。",
    "start": null,
    "end": null,
    "recurrence": "长期",
    "place": "",
    "deadline": null,
    "deadlineText": "长期招募，材料未注明报名截止时间",
    "audience": "all",
    "audienceText": "面向全校学生",
    "requirement": "有摄影设备者优先（不作硬性要求）",
    "notices": [
      {
        "tone": "info",
        "text": "「有摄影设备者优先」是优先级说明，不是门槛——没有设备同样可以报名。"
      }
    ],
    "missing": [
      "报名截止时间",
      "报名方式"
    ],
    "riskLevel": "warn",
    "riskFlags": [
      "未注明报名截止时间"
    ],
    "isNotice": false,
    "addedAt": 16,
    "raw": "长期招募；参与校内大型活动摄影；具体报名截止时间未注明；有摄影设备者优先但不作硬性要求"
  },
  {
    "id": "17",
    "title": "Python程序设计学习资料合集",
    "source": "school",
    "category": "resource",
    "summary": "课程、练习与项目案例合集，长期开放；当前网盘提取信息有效至 9月22日。",
    "start": null,
    "end": null,
    "recurrence": "长期开放",
    "place": "线上",
    "deadline": null,
    "deadlineText": "资料长期开放，网盘提取信息有效至 9月22日",
    "expiryAt": "2026-09-22T23:59",
    "audience": "all",
    "audienceText": "面向全校学生",
    "requirement": "",
    "notices": [
      {
        "tone": "warn",
        "text": "当前这批网盘提取信息 9月22日 之后会失效，届时活动方将统一更新。建议在有效期内先把资料转存到自己的网盘。"
      }
    ],
    "missing": [
      "网盘链接与提取码"
    ],
    "riskLevel": null,
    "riskFlags": [],
    "isNotice": false,
    "addedAt": 17,
    "raw": "包含课程、练习和项目案例；资料长期开放；当前网盘提取信息有效至9月22日，后续将统一更新"
  },
  {
    "id": "18",
    "title": "网络安全兴趣交流小组",
    "source": "school",
    "category": "interest",
    "summary": "首次交流 9月19日 19:30，此后每两周一次，覆盖 CTF、Web 安全等方向。",
    "start": "2026-09-19T19:30",
    "end": null,
    "recurrence": "每两周一次",
    "place": "",
    "deadline": null,
    "deadlineText": "未说明是否需报名",
    "audience": "all",
    "audienceText": "不限基础，面向感兴趣的学生",
    "requirement": "不限基础",
    "notices": [],
    "missing": [
      "活动地点",
      "是否需报名",
      "首次交流时长"
    ],
    "riskLevel": null,
    "riskFlags": [],
    "isNotice": false,
    "addedAt": 18,
    "raw": "首次交流时间为9月19日19:30；之后每两周开展一次；面向CTF、Web安全等方向感兴趣的学生；不限基础"
  },
  {
    "id": "19",
    "title": "学生创新项目路演观摩",
    "source": "school",
    "category": "lecture",
    "summary": "9月20日 14:30 举行；原报名 9月18日 22:00 已截止，现场如有余位可候补入场。",
    "start": "2026-09-20T14:30",
    "end": null,
    "place": "",
    "deadline": "2026-09-18T22:00",
    "deadlineText": "原报名截止 9月18日 22:00（已过）",
    "waitlist": true,
    "audience": "all",
    "audienceText": "面向全校学生",
    "requirement": "",
    "notices": [
      {
        "tone": "info",
        "text": "正常报名通道已关闭，但活动方说明现场仍有余位时可接受候补入场。可以到场试试，但不保证能进。"
      }
    ],
    "missing": [
      "活动地点"
    ],
    "riskLevel": null,
    "riskFlags": [],
    "isNotice": false,
    "addedAt": 19,
    "raw": "活动时间9月20日14:30；原报名截止时间为9月18日22:00；活动方说明如现场仍有余位，可接受候补入场"
  },
  {
    "id": "20",
    "title": "创新创业项目团队补充说明",
    "source": "school",
    "category": "other",
    "summary": "对 03 号招募的补充：开发方向名额已满。",
    "start": null,
    "end": null,
    "place": "",
    "deadline": "2026-09-22T18:00",
    "deadlineText": "报名截止时间不变（9月22日 18:00）",
    "audience": "all",
    "audienceText": "面向全校学生",
    "requirement": "",
    "isNotice": true,
    "supersedes": "03",
    "notices": [
      {
        "tone": "teal",
        "text": "本条是对「大学生创新创业项目团队招募」的修订，已自动合并到 03 号信息中。"
      }
    ],
    "missing": [],
    "riskLevel": null,
    "riskFlags": [],
    "addedAt": 20,
    "raw": "开发方向名额已满，现主要补充设计与材料成员；9月22日18:00截止；此前已投递者无需重复提交"
  },
  {
    "id": "21",
    "title": "计算机学院AI产品设计分享会",
    "source": "college",
    "publisher": "计算机学院",
    "category": "lecture",
    "summary": "9月20日 19:00，明德楼 B203，面向全校，无需报名但座位有限。",
    "start": "2026-09-20T19:00",
    "end": null,
    "place": "明德楼 B203",
    "deadline": null,
    "deadlineText": "无需报名，座位有限先到先得",
    "audience": "all",
    "audienceText": "面向全校学生",
    "requirement": "无需报名",
    "notices": [
      {
        "tone": "info",
        "text": "无需报名，但座位有限。建议提前 10—15 分钟到场。"
      }
    ],
    "missing": [
      "结束时间"
    ],
    "riskLevel": null,
    "riskFlags": [],
    "isNotice": false,
    "addedAt": 21,
    "raw": "计算机学院发布；9月20日19:00；明德楼B203；面向全校学生；无需报名，座位有限"
  },
  {
    "id": "22",
    "title": "周末羽毛球约球",
    "source": "student",
    "category": "interest",
    "summary": "9月20日 16:00，计划 6—8 人，费用 AA，场地待最终确认。",
    "start": "2026-09-20T16:00",
    "end": null,
    "place": "待最终确认",
    "placeText": "场地待最终确认",
    "deadline": null,
    "deadlineText": "未注明截止时间，凑齐人数即止",
    "capacity": 8,
    "capacityText": "计划 6—8 人",
    "cost": "AA 制",
    "audience": "all",
    "audienceText": "不限",
    "requirement": "",
    "notices": [
      {
        "tone": "warn",
        "text": "发布者标注「场地待最终确认」。出发前请先与组织者确认场地，避免白跑一趟。"
      }
    ],
    "missing": [
      "场地",
      "联系方式",
      "报名截止时间"
    ],
    "riskLevel": "warn",
    "riskFlags": [
      "场地尚未确定"
    ],
    "isNotice": false,
    "addedAt": 22,
    "raw": "学生个人发布；9月20日16:00；计划6—8人；费用AA；场地待最终确认"
  },
  {
    "id": "23",
    "title": "AI工具交流搭子招募",
    "source": "student",
    "category": "interest",
    "summary": "拟于 9月21日 晚间开展，欢迎零基础，报名后拉群，地点待定。",
    "start": null,
    "end": null,
    "timeText": "9月21日晚间（具体时间未确定）",
    "place": "未确定",
    "placeText": "地点未确定",
    "deadline": null,
    "deadlineText": "未注明截止时间",
    "audience": "all",
    "audienceText": "不限，欢迎零基础",
    "requirement": "欢迎零基础",
    "notices": [
      {
        "tone": "warn",
        "text": "具体时间与地点都还没有确定，需要报名后进群才能获知。如果你需要提前安排行程，建议先向发布者问清楚。"
      }
    ],
    "missing": [
      "具体时间",
      "具体地点",
      "报名截止时间"
    ],
    "riskLevel": "warn",
    "riskFlags": [
      "时间与地点均未确定"
    ],
    "isNotice": false,
    "addedAt": 23,
    "raw": "学生个人发布；拟于9月21日晚开展；欢迎零基础；报名后拉群；具体地点未确定"
  },
  {
    "id": "24",
    "title": "“校园兼职福利分享”",
    "source": "student",
    "category": "other",
    "summary": "自称「零门槛、日结」，要求添加私人微信获取详情，未提供主办方、地点与完整内容。",
    "start": null,
    "end": null,
    "place": "",
    "deadline": null,
    "deadlineText": "未注明",
    "audience": "all",
    "audienceText": "未说明",
    "requirement": "",
    "notices": [
      {
        "tone": "danger",
        "text": "这条信息没有任何可核实的主办方、时间或地点，且把「加私人微信」作为获取信息的前提。遇到需要先行转账、交押金或提供身份证件的情况，请立即停止并告知老师或家长。"
      }
    ],
    "missing": [
      "主办方",
      "活动时间",
      "活动地点",
      "具体内容",
      "报酬与结算方式"
    ],
    "riskLevel": "danger",
    "riskFlags": [
      "要求添加私人微信才能获取详情",
      "未提供任何可核实的主办方信息",
      "「零门槛、日结」属于常见的高风险招聘话术",
      "未说明活动时间与地点"
    ],
    "isNotice": false,
    "addedAt": 24,
    "raw": "学生个人发布；称“零门槛、日结”，要求添加私人微信获取详情；未提供主办方、地点和完整内容"
  },
  {
    "id": "25",
    "title": "数码新品体验交流",
    "source": "student",
    "category": "other",
    "summary": "标题写「技术交流」，正文主要是某商家优惠与购买链接，未注明活动时间与地点。",
    "start": null,
    "end": null,
    "place": "",
    "deadline": null,
    "deadlineText": "未注明",
    "audience": "all",
    "audienceText": "未说明",
    "requirement": "",
    "notices": [
      {
        "tone": "danger",
        "text": "标题与实际内容不一致：正文是商家优惠与购买链接，更像商业推广而非校园技术交流。建议不要通过该链接下单。"
      }
    ],
    "missing": [
      "活动时间",
      "活动地点",
      "主办方"
    ],
    "riskLevel": "danger",
    "riskFlags": [
      "标题与正文内容不一致",
      "正文包含商品购买链接",
      "带有明显的商业推广特征"
    ],
    "isNotice": false,
    "addedAt": 25,
    "raw": "学生个人发布；标题为技术交流，正文主要介绍某商家优惠及购买链接；活动时间、地点未注明"
  },
  {
    "id": "26",
    "title": "外国语学院校园语言角",
    "source": "college",
    "publisher": "外国语学院",
    "category": "interest",
    "summary": "9月21日 15:00，面向全校，自由交流，场地容量有限，无需提前报名。",
    "start": "2026-09-21T15:00",
    "end": null,
    "place": "",
    "deadline": null,
    "deadlineText": "无需提前报名",
    "audience": "all",
    "audienceText": "面向全校学生",
    "requirement": "无需提前报名",
    "notices": [
      {
        "tone": "info",
        "text": "场地容量有限且无需报名，先到先得。建议提前到场。"
      }
    ],
    "missing": [
      "具体场地",
      "结束时间"
    ],
    "riskLevel": null,
    "riskFlags": [],
    "isNotice": false,
    "addedAt": 26,
    "raw": "外国语学院发布；9月21日15:00；面向全校学生；自由交流；场地容量有限，无需提前报名"
  }
];

/** 需要单独保留的补充通知 id */
export const SEED_NOTICE_IDS = ['09', '20'];

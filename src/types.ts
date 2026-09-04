export type Role = 'student' | 'coach' | 'dietitian';

/** 角色对外展示名（用户端/健康服务团队端共用） */
export const ROLE_LABEL: Record<Role, string> = {
  student: '学员',
  coach: '康复教练',
  dietitian: '营养师',
};

// ============================================================================
//  账户管理类型 (Account Management)
// ============================================================================

/** 营期/期 */
export interface Camp {
  id: string;
  name: string;        // 如 "第一期"
  startDate?: string;  // 开营日期 YYYY-MM-DD
  endDate?: string;    // 结营日期 YYYY-MM-DD
  status: 'upcoming' | 'active' | 'ended';
}

/** 账户（手机号 = 登录凭证，只有配置了手机号的人才能登录） */
export interface Account {
  id: string;
  phone: string;       // 手机号（唯一登录凭证）
  name: string;        // 姓名
  role: Role;          // student | coach | dietitian
  /** 学员所属期（可多选，同一人可参与多期；教练/营养师不强制） */
  campIds?: string[];
  /** 是否启用（禁用后该手机号无法登录） */
  active: boolean;
  createdAt: string;   // 创建时间 YYYY-MM-DD HH:mm:ss
}

export interface MedicalReport {
  url: string;
  type: 'image' | 'pdf';
  name?: string;
}

export interface User {
  id: string;
  role: Role;
  name: string;
  phone: string;
  gender?: 'male' | 'female';
  age?: number;
  height?: number;
  weight?: number;
  /** 目标体重（学员在体重打卡页可设置） */
  targetWeight?: number;
  medicalHistory?: string;
  allergies?: string;
  medicalReports?: MedicalReport[];
}

export interface WeightRecord {
  id: string;
  date: string; // YYYY-MM-DD HH:mm:ss
  weight: number;
  studentId?: string; // 用于多学员数据过滤（健康团队端）
  /** 所属服务批次 ID */
  campId?: string;
  /** 打卡照片 */
  photos?: string[];
  /** 医生/营养师对该条体重记录的批注 */
  dietitianComment?: string;
  /** 批注医生/营养师姓名 */
  dietitianName?: string;
  /** 批注时间 yyyy-MM-dd HH:mm:ss */
  dietitianCommentDate?: string;
  /** 学员对批注的反馈：收到 / 有用 */
  studentFeedback?: 'received' | 'helpful';
  /** 学员是否已读该批注 */
  commentRead?: boolean;
}

export interface ExerciseRecord {
  id: string;
  studentId?: string;
  date: string;
  type: string;
  duration: number;
  intensity: number;
  /** 所属服务批次 ID */
  campId?: string;
  notes?: string;
  photos?: string[];
  /** 运动视频 URL 列表 */
  videoUrls?: string[];
  /** 康复教练对该条运动记录的批注 */
  coachComment?: string;
  coachName?: string;
  coachCommentDate?: string;
  /** 学员对批注的反馈：收到 / 有用 */
  studentFeedback?: 'received' | 'helpful';
  /** 学员是否已读该批注 */
  commentRead?: boolean;
}

export interface DietRecord {
  id: string;
  studentId?: string;
  date: string;
  meal: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  description: string;
  photos: string[];
  /** 所属服务批次 ID */
  campId?: string;
  dietitianComment?: string;
  dietitianName?: string;
  dietitianCommentDate?: string;
  isFasted?: boolean;
  /** 学员对批注的反馈：收到 / 有用 */
  studentFeedback?: 'received' | 'helpful';
  /** 学员是否已读该批注 */
  commentRead?: boolean;
  /** 餐次结构标签（学员打卡时一键勾选） */
  hasStaple?: boolean;    // 有主食
  hasProtein?: boolean;   // 有蛋白质
  hasVegetable?: boolean; // 有蔬菜
}

/** 教练发布的健康指导/教学内容（锻炼活动、康复教学视频等） */
export interface CoachActivityRecord {
  id: string;
  title: string;
  description: string;
  imageUrls: string[];
  coachName: string;
  date: string;
  videoUrls?: string[];
  /** 所属服务批次 ID 列表（空/不填 = 全部批次可见） */
  campIds?: string[];
}

// Meal time configuration
export interface MealTimeSlot {
  start: string;  // "07:00"
  end: string;    // "09:00"
  enabled: boolean;
}

export interface MealTimeConfig {
  breakfast: MealTimeSlot;
  lunch: MealTimeSlot;
  dinner: MealTimeSlot;
  snack: MealTimeSlot;
}

// Health metric configuration (dynamic, configurable by dietitian)
export interface MetricConfig {
  id: string;
  name: string;          // 指标名称
  unit: string;          // 单位
  normalRange?: string;  // 参考区间（非必填）
  category: string;      // 分类（如"身体测量数据"、"血糖相关"）
}

// ============================================================================
//  结营报告 & 统计类型 (Camp Report & Summary Types)
// ============================================================================

/** 单个指标的前后变化 */
export interface MetricChange {
  configId: string;
  name: string;
  unit: string;
  category: string;
  normalRange: string;
  beforeValue: number | string | null;
  afterValue: number | string | null;
  /** 变化量 = after - before（仅数值型有值） */
  change: number | null;
  /** 变化百分比 = change / before * 100 */
  changePercent: number | null;
  /** 是否改善（按指标方向判断） */
  isImproved: boolean;
  /** 开营前是否异常 */
  beforeAbnormal: boolean;
  /** 结营后是否异常 */
  afterAbnormal: boolean;
  /** 异常转正常 */
  turnedNormal: boolean;
}

/** 打卡频率统计 */
export interface CheckinStats {
  /** 训练营总天数 */
  campDays: number;
  /** 有任意打卡记录的天数（含部分打卡） */
  totalCheckinDays: number;
  /** 完成全部打卡的天数（三餐+运动） */
  completeDays: number;
  /** 完成率 = completeDays / campDays */
  completionRate: number;
  /** 有饮食打卡的天数 */
  dietCheckinDays: number;
  /** 有运动打卡的天数 */
  exerciseCheckinDays: number;
  /** 有体重打卡的天数 */
  weightCheckinDays: number;
  /** 饮食打卡总条数 */
  totalDietRecords: number;
  /** 运动打卡总条数 */
  totalExerciseRecords: number;
  /** 体重打卡总条数 */
  totalWeightRecords: number;
  /** 当前连续打卡天数 */
  currentStreak: number;
  /** 最长连续打卡天数（整个营期内） */
  longestStreak: number;
  /** 总运动时长（分钟） */
  totalExerciseDuration: number;
  /** 饮食总得分（每日封顶6分） */
  totalDietScore: number;
}

/** 体重趋势 */
export interface WeightTrend {
  /** 体重记录列表（按日期排序） */
  records: { date: string; weight: number }[];
  /** 初始体重 */
  startWeight: number | null;
  /** 最终体重 */
  endWeight: number | null;
  /** 体重变化 = end - start */
  totalChange: number | null;
  /** 体重变化百分比 */
  changePercent: number | null;
  /** 趋势方向 */
  trend: 'decreasing' | 'increasing' | 'stable' | 'insufficient';
}

/** 学员结营报告 */
export interface StudentCampReport {
  studentId: string;
  studentName: string;
  gender: 'male' | 'female' | undefined;
  campDays: number;
  /** 打卡统计 */
  checkinStats: CheckinStats;
  /** 体重趋势 */
  weightTrend: WeightTrend;
  /** 全部指标变化 */
  metricChanges: MetricChange[];
  /** 核心摘要 */
  summary: {
    weightLossKg: number | null;       // 体重减少量（正数=减了，负数=增了）
    weightLossPercent: number | null;
    bodyFatLossKg: number | null;      // 脂肪减少量
    muscleChangeKg: number | null;     // 肌肉变化量
    visceralFatChange: number | null;  // 内脏脂肪变化
    abnormalCountBefore: number;       // 开营前异常指标数
    abnormalCountAfter: number;        // 结营后异常指标数
    abnormalImprovedCount: number;     // 异常转正常数
    totalCheckinDays: number;
    completionRate: number;
    longestStreak: number;
    totalExerciseDuration: number;
    totalDietScore: number;
  };
}

// ============================================================================
//  B2C 开放健康管理模型 · 新增域
//  (报告健康解读 / 异步答疑 / 异常预警转介 / 随访 / 内容订阅)
// ============================================================================

/** 一份报告健康解读的往返（用户提请求 → 医生解读 → 用户追问 → 医生再答） */
export interface InterpretationExchange {
  /** 解读内容 */
  text: string;
  /** 作者身份 */
  authorName: string;
  /** 发言方：user 提问 / doctor 解读 */
  side: 'user' | 'doctor';
  /** 时间 yyyy-MM-dd HH:mm:ss */
  createdAt: string;
}

/** 报告健康解读请求（U7 / D2）：用户勾指标留问题 → 医生健康解读（非医疗诊断） */
export interface InterpretationRequest {
  id: string;
  /** 发起学员 */
  studentId: string;
  /** 所属服务批次 */
  campId?: string;
  /** 希望解读的指标名（来自健康档案，可多选） */
  indicatorNames: string[];
  /** 学员提交时上传的报告材料图片（化验单/体检单等），营养师解读时查看 */
  materialImages?: string[];
  /** 学员可选填的联系手机号，医生必要时电话沟通 */
  studentPhone?: string;
  /** 用户留言 */
  question: string;
  /** pending 待解读 / answered 已解读 / closed 已关闭 */
  status: 'pending' | 'answered' | 'closed';
  createdAt: string;
  /** 解读医生 */
  doctorId?: string;
  doctorName?: string;
  /** 已解读时间 */
  answeredAt?: string;
  /** 解读+追问往返 */
  exchanges: InterpretationExchange[];
  /** 医生端未读：学员在此后追加过追问/新内容时置 true，医生读取或回复后清 */
  doctorUnread?: boolean;
  /** 学员是否已读最新解读 */
  read?: boolean;
}

/** 异步答疑线程（U8 / D3）：消息型留言，非实时；可索取电话/微信私域凭证 */
export interface ConsultThread {
  id: string;
  studentId: string;
  /** 一线提问 */
  topic: string;
  /** 详情/首次提问正文 */
  question: string;
  createdAt: string;
  /** pending 待回复 / answered 已回复 / closed 已关闭 */
  status: 'pending' | 'answered' | 'closed';
  /** 医生团队成员 */
  replierId?: string;
  replierName?: string;
  replierRole?: Role;
  replies: {
    text: string;
    authorName: string;
    side: 'student' | 'staff';
    createdAt: string;
  }[];
  /** 学员可选填的联系手机号，必要时电话回访 */
  studentPhone?: string;
  /** 医生端未读：学员在此后追加过新回复时置 true，医生读取或回复后清 */
  doctorUnread?: boolean;
  /** 学员是否已读最新回复 */
  read?: boolean;
}

/** 医院健康知识内容（D8 知识发布 / U9 内容订阅 / O5 内容管理） */
export interface KnowledgeContent {
  id: string;
  title: string;
  summary: string;
  imageUrls: string[];
  /** 作者（医生/营养师/康复教练） */
  authorRole: Role;
  authorName: string;
  /** 知识分类：科普图文 / 短视频 */
  contentType: 'article' | 'video';
  createdAt: string;
  videoUrls?: string[];
  /** 可见范围：空/未填 = 全部订阅用户可见（内部置空） */
  campIds?: string[];
  /** 图文正文块：文字段落与中间插图按序（营养师发布）；缺省=旧版仅摘要+文后配图渲染 */
  blocks?: KnowledgeBlock[];
}

/** 健康科普正文块：文字段落 / 中间插图 */
export type KnowledgeBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; url: string };

// ============================================================================
//  慢病（五高 + 同型半胱氨酸）管理域
//  ---------------------------------------------------------------------------
//  六指标族：血压/血糖/血脂/尿酸/体重BMI/同型半胱氨酸；逐项独立记录（适老化）。
//  阈值判定统一走 lib/chronic.ts，学员端「健康看台」与营养师端「五高异常预警」共用。
// ============================================================================

/** 一次慢病测量记录（同一数据下可含多个指标族字段） */
export interface ChronicValues {
  systolic?: number;            // 血压 收缩压 mmHg
  diastolic?: number;           // 血压 舒张压 mmHg
  glucoseFasting?: number;      // 血糖 空腹 mmol/L
  glucosePostprandial?: number; // 血糖 餐后2h mmol/L
  glucoseHba1c?: number;        // 血糖 糖化血红蛋白 %
  ldl?: number;                 // 血脂 低密度脂蛋白 mmol/L
  tg?: number;                  // 血脂 甘油三酯 mmol/L
  tc?: number;                  // 血脂 总胆固醇 mmol/L
  hdl?: number;                 // 血脂 高密度脂蛋白 mmol/L
  uricAcid?: number;            // 尿酸 μmol/L
  weight?: number;              // 体重 kg
  height?: number;              // 身高 cm
  bmi?: number;                 // BMI（可由 weight/height 计算）
  homocysteine?: number;        // 同型半胱氨酸 μmol/L
}

/** 慢病测量记录（学员端录入，营养师端预警依据） */
export interface ChronicRecord {
  id: string;
  studentId: string;
  /** 所属服务批次 */
  campId?: string;
  /** 测量时间 yyyy-MM-dd HH:mm:ss */
  date: string;
  values: ChronicValues;
  /** 记录来源场景备注（选填） */
  note?: string;
}

/** 学员体检报告及其营养师转录的健康档案 */
export interface StudentReport {
  id: string;
  studentId: string;
  /** 报告标题（如"2026-08 入职体检"，选填） */
  title?: string;
  /** 上传的体检报告图片/PDF（拍照或相册，可多张） */
  images: { url: string; type: 'image' | 'pdf'; name?: string }[];
  /** 报告日期（单据日期，无则用上传时间） */
  date: string;
  /** pending=待营养师解读转录；done=已转录成结构化健康档案 */
  status: 'pending' | 'done';
  /** 营养师转录的结构化指标（复用慢性字段口径） */
  values?: Partial<ChronicValues>;
  /** 营养师解读结论文本 */
  note?: string;
  /** 转录时间 yyyy-MM-dd HH:mm:ss */
  interpretedAt?: string;
  /** 转录营养师姓名 */
  interpretedBy?: string;
}

/** 活动页顶部运营位 Banner（营养师在「活动页设置」维护） */
export interface ActivityBanner {
  id: string;
  /** 标题 / 角标文案 */
  title: string;
  /** 展示图（营养师上传；空则显示渐变占位） */
  image: string;
  /** 点击跳转外部链接（http/https），空则不跳转 */
  url: string;
}

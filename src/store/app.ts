import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { showImagePreview } from 'vant';
import type { User, WeightRecord, ExerciseRecord, DietRecord, CoachActivityRecord, MealTimeConfig, MetricConfig, Camp, Account, InterpretationRequest, ConsultThread, KnowledgeContent } from '../types';
import {
  DEFAULT_MEAL_TIME_CONFIG,
  MOCK_DIET_RECORDS,
  MOCK_WEIGHT_RECORDS,
  MOCK_EXERCISE_RECORDS,
  MOCK_COACH_ACTIVITIES,
  DEFAULT_METRIC_CONFIGS,
  MOCK_STUDENTS,
  MOCK_CAMPS,
  MOCK_ACCOUNTS,
  MOCK_INTERPRETATION_REQUESTS,
  MOCK_CONSULT_THREADS,
  MOCK_KNOWLEDGE_CONTENTS,
} from '../mock/data';
import * as api from '../lib/api';
import { latestOrFirstId } from '../lib/camps';

/** 生成 yyyy-MM-dd HH:mm:ss 格式的当前时间字符串（全站统一格式） */
function formatDateTimeStr(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export type View =
  | 'login'
  | 'register'
  | 'questionnaire'
  | 'dashboard'
  | 'upload'
  | 'health-profile'
  | 'exercise'
  | 'diet'
  | 'weight-checkin'
  | 'calendar'
  | 'coach-dashboard'
  | 'coach-student-detail'
  | 'coach-unannotated-list'
  | 'activity-upload'
  | 'dietitian-dashboard'
  | 'dietitian-student-detail'
  | 'dietitian-unannotated-list'
  | 'video-player'
  | 'camp-report'
  | 'personal-journey'
  | 'metric-config'
  | 'messages'
  | 'account-manage'
  | 'dietitian-config'
  // B2C 新增：用户端健康服务入口
  | 'my-team'
  | 'interpretation-request'
  | 'interpretation-result'
  | 'consult'
  | 'article-detail'
  // 健康团队服务（并入营养师「配置」：报告解读 + 健康答疑）
  | 'doctor-interpretation'
  | 'doctor-consult'
  // 内容订阅（并入营养师「配置·管理」）
  | 'ops-content'
  // 内容管理·全屏发布图文（健康科普正文编辑）
  | 'ops-content-new';

export const useAppStore = defineStore('app', () => {
  const user = ref<User | null>(null);
  /** 营养师写给学员的结营寄语 { [`${campId}_${studentId}`]: text } */
  const campMessages = ref<Record<string, string>>({
    'camp1_s1': '坚持下来很不容易，你的自律大家都看在眼里。这段时间养成的饮食和运动习惯是最好的收获，继续保持，健康是一辈子的事！',
  });
  /** 结营寄语作者（营养师姓名），key 同 campMessages：{ [`${campId}_${studentId}`]: name } */
  const campMessageAuthors = ref<Record<string, string>>({});

  function setCampMessage(campId: string, studentId: string, text: string, author = '') {
    const key = `${campId}_${studentId}`;
    if (text.trim()) {
      campMessages.value = { ...campMessages.value, [key]: text.trim() };
      if (author) campMessageAuthors.value = { ...campMessageAuthors.value, [key]: author };
    } else {
      const next = { ...campMessages.value };
      delete next[key];
      campMessages.value = next;
      const aNext = { ...campMessageAuthors.value };
      delete aNext[key];
      campMessageAuthors.value = aNext;
    }
    api.saveCampMessage(campId, studentId, text).catch(() => {});
  }

  function getCampMessage(campId: string, studentId: string): string {
    return campMessages.value[`${campId}_${studentId}`] || '';
  }

  function getCampMessageAuthor(campId: string, studentId: string): string {
    return campMessageAuthors.value[`${campId}_${studentId}`] || '';
  }
  const viewHistory = ref<View[]>(['login']);
  const currentView = computed<View>(() => viewHistory.value[viewHistory.value.length - 1]);

  const questionnaireAnswered = ref(false);
  const students = ref<typeof MOCK_STUDENTS>([...MOCK_STUDENTS]);
  const weightRecords = ref<WeightRecord[]>([...MOCK_WEIGHT_RECORDS]);
  const exerciseRecords = ref<ExerciseRecord[]>([...MOCK_EXERCISE_RECORDS]);
  const dietRecords = ref<DietRecord[]>([...MOCK_DIET_RECORDS]);
  const coachActivities = ref<CoachActivityRecord[]>([...MOCK_COACH_ACTIVITIES]);
  // 正在编辑的教练活动（from coach dashboard → activity-upload 编辑模式）
  const editingActivity = ref<CoachActivityRecord | null>(null);
  // 教练端首页当前激活 Tab（持久化，返回/编辑发布后回到对应 Tab，而非重置到「未运动」）
  const coachDashboardTab = ref<'incomplete' | 'completed' | 'activities'>('incomplete');
  const mealTimeConfigByCamp = ref<Record<string, MealTimeConfig>>({});
  const metricConfigs = ref<MetricConfig[]>([...DEFAULT_METRIC_CONFIGS]);

  /** 营期列表 */
  const camps = ref<Camp[]>([...MOCK_CAMPS]);
  /** 账户列表（手机号=登录凭证） */
  const accounts = ref<Account[]>([...MOCK_ACCOUNTS]);

  // ─── B2C 开放健康管理模型 · 新增域状态 ───
  /** 报告健康解读请求（U7/D2） */
  const interpretationRequests = ref<InterpretationRequest[]>([...MOCK_INTERPRETATION_REQUESTS]);
  /** 异步健康答疑线程（U8/D3） */
  const consultThreads = ref<ConsultThread[]>([...MOCK_CONSULT_THREADS]);
  /** 医院健康知识内容（D8/U9/O5） */
  const knowledgeContents = ref<KnowledgeContent[]>([...MOCK_KNOWLEDGE_CONTENTS]);
  /** 当前打开的解读/答疑线程 ID（医生端查看某条） */
  const activeRequestId = ref<string | null>(null);
  const activeThreadId = ref<string | null>(null);

  function setActiveRequestId(id: string | null) { activeRequestId.value = id; }
  function setActiveThreadId(id: string | null) { activeThreadId.value = id; }

  const selectedStudentId = ref<string | null>(null);
  const selectedDateStr = ref<string | null>(null);
  // 教练批注深链：跳转到某条运动记录（教练学员详情页滚动定位到该条后清空）
  const coachFocusRecordId = ref<string | null>(null);


  /** 学员端当前选中的营期 ID（多期学员可切换；null 时自动取第一个 active 营期） */
  const selectedCampId = ref<string | null>(null);

  /** 学员详情（营养师/教练查看某学员档案）流内的营期上下文，独立于全局 selectedCampId，不影响首页营期 */
  const detailSelectedCampId = ref<string | null>(null);

  /** 学员登录预录入开关：true=学员必须先在账户管理中提前录入手机号才能登录(验证登录)；false=开放登录(任意手机号自动建档为学员)。
   *  仅影响学员；营养师/教练始终需在账户管理中维护手机号。 */
  const studentRequiresPreRegister = ref(false);

  /** 刚完成打卡标记（用于返回首页时触发成就/里程碑检测） */
  const justCheckedIn = ref(false);

  /** 待批注列表点击跳转时携带的目标记录信息（用于营养师端自动切 Tab + 滚动定位） */
  const pendingRecordType = ref<'diet' | 'weight' | 'exercise' | null>(null);
  const pendingRecordId = ref<string | null>(null);

  function setPendingAnnotation(type: 'diet' | 'weight' | 'exercise' | null, recordId: string | null = null) {
    pendingRecordType.value = type;
    pendingRecordId.value = recordId;
  }

  const videoPreview = ref<{ url: string } | null>(null);

  // ============================================================================
  //  业务数据 localStorage 持久化（纯前端 demo：业务数据默认只在内存，刷新/跨会话即丢）
  //  ---------------------------------------------------------------------------
  //  用一个快照桶把主要可变业务数据统一写进 localStorage，并在 init() 时回读，
  //  让批注等跨角色操作的成果在刷新或同浏览器重进页面后仍然可见。
  //  边界：demo 无共享后端，跨浏览器/设备仍无法同步；这里仅解决"同浏览器刷新/换号"的丢数。
  // ============================================================================
  const BIZ_KEY = 'camp_biz_data_v1';
  const bizSources = [
    students, weightRecords, exerciseRecords, dietRecords, coachActivities,
    metricConfigs, camps, accounts, mealTimeConfigByCamp,
    interpretationRequests, consultThreads, knowledgeContents, studentRequiresPreRegister,
  ];
  const bizNames = [
    'students', 'weightRecords', 'exerciseRecords', 'dietRecords', 'coachActivities',
    'metricConfigs', 'camps', 'accounts', 'mealTimeConfigByCamp',
    'interpretationRequests', 'consultThreads', 'knowledgeContents', 'studentRequiresPreRegister',
  ] as const;
  function persistBiz() {
    const snap: Record<string, unknown> = {};
    bizSources.forEach((src, i) => { snap[bizNames[i]] = src.value; });
    try { localStorage.setItem(BIZ_KEY, JSON.stringify(snap)); } catch { /* 隐私模式/超限：静默降级为内存，不影响功能 */ }
  }
  /** 从 localStorage 回读业务数据并覆盖各 ref；无可用数据返回 false */
  function restoreBiz(): boolean {
    try {
      const raw = localStorage.getItem(BIZ_KEY);
      if (!raw) return false;
      const snap = JSON.parse(raw) as Record<string, unknown>;
      let hasData = false;
      bizSources.forEach((src, i) => {
        if (snap[bizNames[i]] !== undefined) { (src as { value: unknown }).value = snap[bizNames[i]]; hasData = true; }
      });
      return hasData;
    } catch { return false; }
  }
  let persistTimer: ReturnType<typeof setTimeout> | undefined;
  // 任何业务数据变化后防抖写盘（demo 数据量小；防抖避免批注输入时高频序列化）
  watch(bizSources as any, () => { clearTimeout(persistTimer); persistTimer = setTimeout(persistBiz, 400); }, { deep: true });

  // 联调加载：USE_MOCK=true 时返回同一份 mock（无副作用）；USE_MOCK=false 时从后端拉取
  async function init() {
    // 已有本地持久化的业务数据时直接回读，避免后续被 MOCK 种子覆盖（保证批注等成果刷新后仍在）
    if (restoreBiz()) return;
    try {
      const [studentList, diet, exercise, weight, activities, metricCfgs, campList, accountList] = await Promise.all([
        api.getStudents(),
        api.getDietRecords(),
        api.getExerciseRecords(),
        api.getWeightRecords(),
        api.getCoachActivities(),
        api.getMetricConfigs(),
        api.getCamps(),
        api.getAccounts(),
      ]);
      students.value = studentList;
      dietRecords.value = diet;
      exerciseRecords.value = exercise;
      weightRecords.value = weight;
      coachActivities.value = activities;
      metricConfigs.value = metricCfgs;
      camps.value = campList;
      accounts.value = accountList;

      persistBiz(); // 首次拉取后建立持久化基线（记录被改前内存态无存储基线）

      // 按营期加载餐时配置
      for (const camp of campList) {
        try {
          const mealCfg = await api.getMealTimeConfigByCamp(camp.id);
          if (mealCfg) {
            mealTimeConfigByCamp.value = { ...mealTimeConfigByCamp.value, [camp.id]: mealCfg };
          }
        } catch {
          // 单个营期配置加载失败不影响整体
        }
      }
    } catch (e) {
      // 联调失败保留 mock 初值
    }
  }

  /** 默认展示最新营期：学员取本人所属期中最新的，教练取其负责期中最新的，营养师取全局最新的 */
  function applyLatestCampDefault() {
    if (!user.value) return;
    let pool: Camp[];
    if (user.value.role === 'student') {
      pool = getStudentCamps(user.value.id);
    } else if (user.value.role === 'coach') {
      pool = getCoachCamps();
    } else {
      pool = camps.value;
    }
    const latestId = latestOrFirstId(pool);
    if (latestId) selectedCampId.value = latestId;
  }

  function setUser(u: User | null) {
    user.value = u;
    if (u) {
      // 默认展示最新营期（学员取本人所属期中最新的，营养师/教练取全局最新的）
      applyLatestCampDefault();
      // 持久化登录态到 localStorage，实现保活
      const authData = {
        user: u,
        timestamp: Date.now(),
      };
      localStorage.setItem('camp_auth', JSON.stringify(authData));
    } else {
      localStorage.removeItem('camp_auth');
    }
  }

  /** 更新当前登录用户的个人信息（姓名/性别等），同步到 user + accounts + students + localStorage */
  function updateUserProfile(updates: Partial<User>) {
    if (!user.value) return;
    user.value = { ...user.value, ...updates };
    // 同步 name/gender/age 到 students 列表
    if (updates.name !== undefined || updates.gender !== undefined || updates.age !== undefined) {
      students.value = students.value.map((s) =>
        s.id === user.value!.id
          ? { ...s, name: updates.name ?? s.name, gender: updates.gender ?? s.gender, age: updates.age ?? s.age }
          : s,
      );
    }
    // 同步 name 到 accounts 列表（营养师端账号管理可见）
    if (updates.name !== undefined) {
      accounts.value = accounts.value.map((a) =>
        a.id === user.value!.id ? { ...a, name: updates.name! } : a,
      );
    }
    // 重新持久化
    const authData = { user: user.value, timestamp: Date.now() };
    localStorage.setItem('camp_auth', JSON.stringify(authData));
  }

  /** 从 localStorage 恢复登录态（页面刷新/重新打开时自动登录） */
  function restoreAuth(): boolean {
    try {
      const raw = localStorage.getItem('camp_auth');
      if (!raw) return false;
      const data = JSON.parse(raw);
      // 30 天过期
      const maxAge = 30 * 24 * 60 * 60 * 1000;
      if (Date.now() - data.timestamp > maxAge) {
        localStorage.removeItem('camp_auth');
        return false;
      }
      if (data.user && data.user.role) {
        // P0：退营学员刷新/重开不得自动重登——重查 active（登录时已拦，但持久化 camp_auth 会绕过）
        if (data.user.role === 'student') {
          const account = accounts.value.find((a) => a.id === data.user.id && a.role === 'student');
          if (account && account.active === false) {
            localStorage.removeItem('camp_auth');
            return false;
          }
        }
        user.value = data.user;
        // 默认展示最新营期
        applyLatestCampDefault();
        // 恢复问卷状态
        const qSaved = localStorage.getItem('submitted_questionnaire');
        questionnaireAnswered.value = !!qSaved;
        // 根据角色和问卷状态跳转到对应首页
        if (data.user.role === 'coach') {
          viewHistory.value = ['coach-dashboard'];
        } else if (data.user.role === 'dietitian') {
          viewHistory.value = ['dietitian-dashboard'];
        } else {
          // 学员：已填问卷 -> 首页，未填 -> 问卷页
          viewHistory.value = [qSaved ? 'dashboard' : 'questionnaire'];
        }
        return true;
      }
    } catch (e) {
      // JSON 解析失败，清除无效数据
      localStorage.removeItem('camp_auth');
    }
    return false;
  }

  /** 学员是否已退营（active=false）。退营是全局状态，任何资金/打卡写操作都须守此闸门。 */
  function isStudentDisabled(studentId: string): boolean {
    const acc = accounts.value.find((a) => a.id === studentId && a.role === 'student');
    return acc ? acc.active === false : false;
  }

  /** 退出登录 */
  function logout() {
    user.value = null;
    selectedCampId.value = null;
    localStorage.removeItem('camp_auth');
    viewHistory.value = ['login'];
  }

  /** 底部 Tab 根页面（切换时去重，避免历史栈无限增长） */
  // 学员端底部Tab：首页/消息/健康；教练/营养师端各自的底部Tab根页
  const TAB_ROOTS: View[] = ['dashboard', 'messages', 'health-profile', 'coach-dashboard', 'dietitian-dashboard', 'dietitian-unannotated-list', 'dietitian-config'];

  /** 学员详情流视图：在此流内继承 detailSelectedCampId，离开则清空（不污染全局 selectedCampId） */
  const DETAIL_FLOW_VIEWS: View[] = ['dietitian-student-detail', 'coach-student-detail'];

  function setCurrentView(view: View) {
    const current = viewHistory.value[viewHistory.value.length - 1];
    if (current === view) return;

    // Tab 根页面切换：若目标根页已在历史栈中，截断到该位置（模拟原生 Tab 行为）；
    // 尚未进入过历史栈时（如登录/首次切换该根页），必须 push，否则无法跳转。
    if (TAB_ROOTS.includes(view)) {
      const idx = viewHistory.value.lastIndexOf(view);
      if (idx >= 0) {
        viewHistory.value = viewHistory.value.slice(0, idx + 1);
        // 回到根页面时清空详情流营期上下文
        detailSelectedCampId.value = null;
        return;
      }
    }

    viewHistory.value.push(view);
    // 离开详情流时清空详情营期上下文
    if (!DETAIL_FLOW_VIEWS.includes(view)) detailSelectedCampId.value = null;
  }

  function goBack() {
    if (viewHistory.value.length > 1) {
      viewHistory.value.pop();
      if (!DETAIL_FLOW_VIEWS.includes(currentView.value)) detailSelectedCampId.value = null;
    }
  }

  function setQuestionnaireAnswered(v: boolean) {
    questionnaireAnswered.value = v;
  }

  function addWeightRecord(record: WeightRecord) {
    if (isStudentDisabled(record.studentId)) return; // 退营学员禁止继续打卡
    weightRecords.value.push(record);
    api.createWeightRecord(record).catch(() => {});
  }

  /** 更新体重记录（营养师批注使用） */
  function updateWeightRecord(id: string, updates: Partial<WeightRecord>) {
    weightRecords.value = weightRecords.value.map((r) => (r.id === id ? { ...r, ...updates } : r));
    api.updateWeightRecord(id, updates).catch(() => {});
  }

  function addExerciseRecord(record: ExerciseRecord) {
    if (isStudentDisabled(record.studentId)) return; // 退营学员禁止继续打卡
    exerciseRecords.value.push(record);
    api.createExerciseRecord(record).catch(() => {});
  }

  /** 更新运动记录（营养师批注使用） */
  function updateExerciseRecord(id: string, updates: Partial<ExerciseRecord>) {
    exerciseRecords.value = exerciseRecords.value.map((r) => (r.id === id ? { ...r, ...updates } : r));
    api.updateExerciseRecord(id, updates).catch(() => {});
  }

  function addDietRecord(record: DietRecord) {
    if (isStudentDisabled(record.studentId)) return; // 退营学员禁止继续打卡
    // 幂等：同一学员、同一营期、同一天、同一餐次不重复插入（防绕过前端重复打卡）
    const day = (record.date || '').slice(0, 10);
    const exists = dietRecords.value.some(
      (r) => r.studentId === record.studentId
        && r.campId === record.campId
        && r.meal === record.meal
        && (r.date || '').startsWith(day),
    );
    if (exists) return;
    dietRecords.value.push(record);
    api.createDietRecord(record).catch(() => {});
  }

  function updateDietRecord(id: string, updates: Partial<DietRecord>) {
    dietRecords.value = dietRecords.value.map((r) => (r.id === id ? { ...r, ...updates } : r));
    api.updateDietRecord(id, updates).catch(() => {});
  }


  function addCoachActivity(record: CoachActivityRecord) {
    coachActivities.value.push(record);
    api.createCoachActivity(record).catch(() => {});
  }

  function updateCoachActivity(id: string, updates: Partial<CoachActivityRecord>) {
    const idx = coachActivities.value.findIndex((a) => a.id === id);
    if (idx >= 0) coachActivities.value[idx] = { ...coachActivities.value[idx], ...updates, id };
    api.updateCoachActivity(id, updates).catch(() => {});
  }

  function deleteCoachActivity(id: string) {
    coachActivities.value = coachActivities.value.filter((a) => a.id !== id);
    api.deleteCoachActivity(id).catch(() => {});
  }

  function setEditingActivity(record: CoachActivityRecord | null) {
    editingActivity.value = record;
  }

  function setSelectedStudentId(id: string | null) {
    selectedStudentId.value = id;
  }

  function setSelectedDateStr(date: string | null) {
    selectedDateStr.value = date;
  }

  function openImagePreview(urls: string[], index: number = 0) {
    if (urls.length > 0) {
      showImagePreview({ images: urls, startPosition: index, closeable: true });
    }
  }

  function openVideoPreview(url: string) {
    videoPreview.value = { url };
  }

  /** 学员端「健康活动」当前正在阅读的文章（锻炼活动 / 健康科普，公众号推送式详情） */
  const activeArticle = ref<{ kind: 'activity' | 'knowledge'; item: CoachActivityRecord | KnowledgeContent } | null>(null);

  function openArticle(kind: 'activity' | 'knowledge', item: CoachActivityRecord | KnowledgeContent) {
    activeArticle.value = { kind, item };
    setCurrentView('article-detail');
  }

  function getMealTimeConfig(campId: string): MealTimeConfig {
    return mealTimeConfigByCamp.value[campId] || { ...DEFAULT_MEAL_TIME_CONFIG };
  }

  function updateMealTimeConfig(campId: string, config: MealTimeConfig) {
    mealTimeConfigByCamp.value = { ...mealTimeConfigByCamp.value, [campId]: { ...config } };
    api.updateMealTimeConfigByCamp(campId, config).catch(() => {});
  }

  function addMetricConfig(config: MetricConfig) {
    metricConfigs.value.push(config);
    api.createMetricConfig(config).catch(() => {});
  }

  function updateMetricConfig(id: string, updates: Partial<MetricConfig>) {
    metricConfigs.value = metricConfigs.value.map((c) => (c.id === id ? { ...c, ...updates } : c));
    api.updateMetricConfig(id, updates).catch(() => {});
  }

  function deleteMetricConfig(id: string) {
    metricConfigs.value = metricConfigs.value.filter((c) => c.id !== id);
    api.deleteMetricConfig(id).catch(() => {});
  }

  function closeVideoPreview() {
    videoPreview.value = null;
  }

  // ─── 营期管理 ───
  function addCamp(camp: Camp) {
    camps.value.push(camp);
    api.createCamp(camp).catch(() => {});
  }
  function updateCamp(id: string, updates: Partial<Camp>) {
    camps.value = camps.value.map((c) => (c.id === id ? { ...c, ...updates } : c));
    api.updateCamp(id, updates).catch(() => {});
  }
  function deleteCamp(id: string) {
    camps.value = camps.value.filter((c) => c.id !== id);
    api.deleteCamp(id).catch(() => {});
  }

  // ─── 账户管理 ───
  /** 学员登录：已知手机号返回其账户（角色匹配在 LoginView 校验）；
   *  未知手机号：预录入开启时一律拒绝（须先在账户管理中录入），否则自动建档为学员，挂到默认活跃营期，返回 created=true。 */
  function openStudentLogin(phone: string): { account: Account | null; created: boolean } {
    const existing = accounts.value.find((a) => a.phone === phone && a.active);
    if (existing) return { account: existing, created: false };
    // 预录入关闭=开放登录；开启时未知手机号必须先在账户管理中录入为学员，禁止自动建档
    if (studentRequiresPreRegister.value) return { account: null, created: false };
    // 未知手机号：自动建档为学员
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const createdAt = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    // 开放登录：未知手机号一律归入「开放营期」兜底批次；若该批次被删则回退第一个活跃期，再无则第一个
    const defaultCamp =
      camps.value.find((c) => c.id === 'open')
      || camps.value.find((c) => c.status === 'active')
      || camps.value[0];
    const account: Account = {
      id: `s_${phone}_${now.getTime()}`,
      phone,
      name: `学员${phone.slice(-4)}`,
      role: 'student',
      campIds: defaultCamp ? [defaultCamp.id] : [],
      active: true,
      createdAt,
    };
    accounts.value.push(account);
    return { account, created: true };
  }
  function addAccount(account: Account) {
    accounts.value.push(account);
    api.createAccount(account).catch(() => {});
  }
  function updateAccount(id: string, updates: Partial<Account>) {
    accounts.value = accounts.value.map((a) => (a.id === id ? { ...a, ...updates } : a));
    api.updateAccount(id, updates).catch(() => {});
  }
  function deleteAccount(id: string) {
    accounts.value = accounts.value.filter((a) => a.id !== id);
    api.deleteAccount(id).catch(() => {});
  }

  /** 获取学员的所有营期列表 */
  function getStudentCamps(studentId: string): Camp[] {
    const account = accounts.value.find((a) => a.id === studentId);
    if (!account?.campIds || account.campIds.length === 0) return [];
    return camps.value.filter((c) => account.campIds!.includes(c.id));
  }

  /** 获取学员当前营期（详情流优先 detailSelectedCampId，其次全局 selectedCampId，否则取第一个 active） */
  function getStudentCamp(studentId: string): Camp | null {
    const studentCamps = getStudentCamps(studentId);
    if (studentCamps.length === 0) return null;
    // 详情流上下文营期（学员档案内独立切换，不影响全局）优先
    if (detailSelectedCampId.value && studentCamps.some((c) => c.id === detailSelectedCampId.value)) {
      return studentCamps.find((c) => c.id === detailSelectedCampId.value) || null;
    }
    // 优先使用学员选中的营期（且该营期属于此学员）
    if (selectedCampId.value && studentCamps.some((c) => c.id === selectedCampId.value)) {
      return studentCamps.find((c) => c.id === selectedCampId.value) || null;
    }
    // 自动选择：优先 active，其次 ended，最后 upcoming
    const active = studentCamps.find((c) => c.status === 'active');
    const ended = studentCamps.find((c) => c.status === 'ended');
    const upcoming = studentCamps.find((c) => c.status === 'upcoming');
    return active || ended || upcoming || studentCamps[0];
  }

  /** 获取营期天数（从 start/end 日期计算；无日期则返回默认 28 天） */
  function getCampDays(studentId: string): number {
    const camp = getStudentCamp(studentId);
    if (camp?.startDate && camp?.endDate) {
      const start = new Date(camp.startDate);
      const end = new Date(camp.endDate);
      const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      return diff > 0 ? diff : 28;
    }
    return 28;
  }

  /** 结营报告是否可查看（营期已结束，即当前日期 > 结营日期） */
  function canViewCampReport(studentId: string): boolean {
    const camp = getStudentCamp(studentId);
    if (!camp) return false;
    if (camp.status === 'ended') return true;
    if (camp.endDate) {
      const end = new Date(camp.endDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return today > end;
    }
    return false;
  }

  /** 营期是否已开营（当前日期 >= 开营日期；status 优先，无 status 时按 startDate 判断） */
  function isCampStarted(camp: Camp | null | undefined): boolean {
    if (!camp) return true; // 无营期信息时不限制
    if (camp.status === 'upcoming') return false;
    if (camp.status === 'active' || camp.status === 'ended') return true;
    if (camp.startDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const start = new Date(camp.startDate);
      start.setHours(0, 0, 0, 0);
      return today >= start;
    }
    return true;
  }

  /** 学员当前营期是否已开营（学员能否打卡）。退营学员一律禁止。 */
  function canStudentCheckIn(studentId: string): boolean {
    if (isStudentDisabled(studentId)) return false;
    return isCampStarted(getStudentCamp(studentId));
  }

  // ─── 按营期过滤打卡记录（campId 精确匹配，不靠日期范围猜测） ──────
  function getCampDietRecords(campId: string) {
    return dietRecords.value.filter((r) => r.campId === campId);
  }
  function getCampExerciseRecords(campId: string) {
    return exerciseRecords.value.filter((r) => r.campId === campId);
  }
  function getCampWeightRecords(campId: string) {
    return weightRecords.value.filter((r) => r.campId === campId);
  }
  function getCampCoachActivities(campId: string) {
    return coachActivities.value.filter((a) => !a.campIds || a.campIds.length === 0 || a.campIds.includes(campId));
  }

  /**
   * 学员「消息」Tab 角标总数 = 批注未读(营养师/医生 + 康复教练) + 报告解读已回未读 + 答疑已复未读 的条数。
   * 供各学员页底部 StudentTabbar 的 messages badge 统一使用，保证任何页面下角标一致。
   */
  function getStudentMsgUnreadCount(studentId: string): number {
    const camp = getStudentCamp(studentId);
    const cid = camp?.id || null;
    const diet = (cid ? getCampDietRecords(cid) : dietRecords.value).filter(
      (r) => r.studentId === studentId && r.dietitianComment && !r.commentRead,
    );
    const ex = (cid ? getCampExerciseRecords(cid) : exerciseRecords.value).filter(
      (r) => r.studentId === studentId && r.coachComment && !r.commentRead,
    );
    const wt = (cid ? getCampWeightRecords(cid) : weightRecords.value).filter(
      (r) => r.studentId === studentId && r.dietitianComment && !r.commentRead,
    );
    // 报告健康解读：医生已解读但学员未读
    const irUnread = interpretationRequests.value.filter((r) => r.studentId === studentId && r.status === 'answered' && !r.read).length;
    // 异步答疑：医生已回复但学员未读
    const ctUnread = consultThreads.value.filter((t) => t.studentId === studentId && t.status === 'answered' && !t.read).length;
    return diet.length + ex.length + wt.length + irUnread + ctUnread;
  }

  /** 获取教练负责的营期列表（从 coach account.campIds 获取） */
  function getCoachCamps(): Camp[] {
    if (!user.value || user.value.role !== 'coach') return [];
    const account = accounts.value.find(a => a.id === user.value!.id || a.phone === user.value!.phone);
    if (!account?.campIds || account.campIds.length === 0) return camps.value.filter(c => c.status === 'active');
    return camps.value.filter(c => account.campIds.includes(c.id));
  }

  /** 获取教练负责的学员列表（按教练营期过滤） */
  function getCoachStudents(): { id: string; name: string; phone: string; gender?: 'male' | 'female'; age?: number }[] {
    const coachCamps = getCoachCamps();
    if (coachCamps.length === 0) return [];
    const campIds = coachCamps.map(c => c.id);
    return accounts.value
      .filter(a => a.role === 'student' && a.active && a.campIds?.some(id => campIds.includes(id)))
      .map(a => {
        const studentInfo = students.value.find(s => s.id === a.id);
        return {
          id: a.id,
          name: a.name,
          phone: a.phone,
          gender: studentInfo?.gender,
          age: studentInfo?.age,
        };
      });
  }

  /** 获取指定营期的学员列表（从 accounts 中筛选 campIds 包含该营期且 active 的学员） */
  function getStudentsByCamp(campId: string): { id: string; name: string; phone: string; gender?: 'male' | 'female'; age?: number }[] {
    return accounts.value
      .filter((a) => a.role === 'student' && a.active && a.campIds?.includes(campId))
      .map((a) => {
        // 从 students 列表补充 gender/age 信息
        const studentInfo = students.value.find((s) => s.id === a.id);
        return {
          id: a.id,
          name: a.name,
          phone: a.phone,
          gender: studentInfo?.gender,
          age: studentInfo?.age,
        };
      });
  }

  /** 获取所有活跃学员（不限营期） */
  function getAllStudents(): { id: string; name: string; phone: string; gender?: 'male' | 'female'; age?: number }[] {
    return accounts.value
      .filter((a) => a.role === 'student' && a.active)
      .map((a) => {
        const studentInfo = students.value.find((s) => s.id === a.id);
        return {
          id: a.id,
          name: a.name,
          phone: a.phone,
          gender: studentInfo?.gender,
          age: studentInfo?.age,
        };
      });
  }

  /** 获取学员的当前营期 ID（优先 active，其次 ended） */
  function getStudentCampId(studentId: string): string | null {
    const camp = getStudentCamp(studentId);
    return camp?.id || null;
  }

  // ============================================================================
  //  B2C 新增域：报告健康解读 / 异步答疑 / 风险画像 / 转介 / 随访 / 知识内容
  //  注：demo 纯前端，状态存内存 + localStorage 持久化；接口语义已对齐，便于后续接后端。
  // ============================================================================
  const _seq = { n: 0 };

  function submitInterpretationRequest(studentId: string, indicatorNames: string[], question: string, materialImages: string[] = []) {
    const now = formatDateTimeStr();
    const req: InterpretationRequest = {
      id: `ir_${Date.now()}_${_seq.n++}`,
      studentId,
      campId: getStudentCampId(studentId) || undefined,
      indicatorNames,
      materialImages,
      question,
      status: 'pending',
      createdAt: now,
      exchanges: [],
      read: false,
    };
    interpretationRequests.value.unshift(req);
    return req.id;
  }

  function answerInterpretation(id: string, text: string) {
    const req = interpretationRequests.value.find((r) => r.id === id);
    if (!req) return;
    const now = formatDateTimeStr();
    req.status = 'answered';
    req.doctorId = user.value?.id || 'd1';
    req.doctorName = user.value?.name || '营养师';
    req.answeredAt = now;
    req.exchanges.push({ text, authorName: user.value?.name || '营养师', side: 'doctor', createdAt: now });
    req.read = false;
  }

  function followupInterpretation(id: string, text: string, side: 'user' | 'doctor' = 'user') {
    const req = interpretationRequests.value.find((r) => r.id === id);
    if (!req) return;
    req.exchanges.push({
      text,
      authorName: side === 'user' ? studentName(req.studentId) : user.value?.name || '营养师',
      side,
      createdAt: formatDateTimeStr(),
    });
    if (side === 'user') req.status = 'answered'; // 追问后保持已解读
    if (side === 'doctor') req.read = false;
  }

  function markInterpretationRead(id: string) {
    const req = interpretationRequests.value.find((r) => r.id === id);
    if (req) req.read = true;
  }

  function studentName(studentId: string): string {
    const s = students.value.find((x) => x.id === studentId);
    if (s?.name) return s.name;
    const a = accounts.value.find((x) => x.id === studentId);
    return a?.name || '学员';
  }

  /** 某学员的报告解读请求（最新在前） */
  function getStudentInterpretations(studentId: string) {
    return interpretationRequests.value.filter((r) => r.studentId === studentId);
  }
  /** 医生端待解读队列 */
  function getPendingInterpretations() {
    return interpretationRequests.value.filter((r) => r.status === 'pending');
  }

  function askConsult(studentId: string, topic: string, question: string) {
    const thread: ConsultThread = {
      id: `ct_${Date.now()}_${_seq.n++}`,
      studentId,
      topic,
      question,
      createdAt: formatDateTimeStr(),
      status: 'pending',
      replies: [],
      read: false,
    };
    consultThreads.value.unshift(thread);
    return thread.id;
  }

  function staffReplyConsult(id: string, text: string) {
    const t = consultThreads.value.find((x) => x.id === id);
    if (!t) return;
    t.status = 'answered';
    t.replierId = user.value?.id || 'd1';
    t.replierName = user.value?.name || '营养师';
    t.replierRole = user.value?.role === 'coach' ? 'coach' : 'dietitian';
    t.replies.push({ text, authorName: user.value?.name || '营养师', side: 'staff', createdAt: formatDateTimeStr() });
    t.read = false;
  }

  function studentReplyConsult(id: string, text: string) {
    const t = consultThreads.value.find((x) => x.id === id);
    if (!t) return;
    t.replies.push({ text, authorName: studentName(t.studentId), side: 'student', createdAt: formatDateTimeStr() });
    t.status = 'answered';
  }

  function setConsultContact(id: string, contact: { type: 'phone' | 'wechat'; value: string }) {
    const t = consultThreads.value.find((x) => x.id === id);
    if (t) t.contact = contact;
  }

  function markThreadRead(id: string) {
    const t = consultThreads.value.find((x) => x.id === id);
    if (t) t.read = true;
  }

  function getStudentThreads(studentId: string) {
    return consultThreads.value.filter((t) => t.studentId === studentId);
  }
  function getPendingThreads() {
    return consultThreads.value.filter((t) => t.status === 'pending');
  }

  function addKnowledgeContent(data: Omit<KnowledgeContent, 'id' | 'createdAt'>) {
    const k: KnowledgeContent = { ...data, id: `kc_${Date.now()}_${_seq.n++}`, createdAt: formatDateTimeStr() };
    knowledgeContents.value.unshift(k);
    return k.id;
  }
  function deleteKnowledgeContent(id: string) {
    knowledgeContents.value = knowledgeContents.value.filter((k) => k.id !== id);
  }

  return {
    user,
    campMessages,
    setCampMessage,
    getCampMessage,
    getCampMessageAuthor,
    currentView,
    init,
    questionnaireAnswered,
    students,
    weightRecords,
    exerciseRecords,
    dietRecords,
    coachActivities,
    getCampCoachActivities,
    selectedStudentId,
    selectedDateStr,
    coachFocusRecordId,
    selectedCampId,
    detailSelectedCampId,
    justCheckedIn,
    pendingRecordType,
    pendingRecordId,
    setPendingAnnotation,
    videoPreview,
    setUser,
    updateUserProfile,
    restoreAuth,
    logout,
    setCurrentView,
    goBack,
    setQuestionnaireAnswered,
    addWeightRecord,
    updateWeightRecord,
    addExerciseRecord,
    updateExerciseRecord,
    addDietRecord,
    updateDietRecord,
    addCoachActivity,
    updateCoachActivity,
    deleteCoachActivity,
    setEditingActivity,
    editingActivity,
    coachDashboardTab,
    setSelectedStudentId,
    setSelectedDateStr,
    getStudentMsgUnreadCount,
    getCampDietRecords,
    getCampExerciseRecords,
    getCampWeightRecords,
    mealTimeConfigByCamp,
    getMealTimeConfig,
    updateMealTimeConfig,
    metricConfigs,
    addMetricConfig,
    updateMetricConfig,
    deleteMetricConfig,
    openImagePreview,
    openVideoPreview,
    activeArticle,
    openArticle,
    closeVideoPreview,
    camps,
    accounts,
    studentRequiresPreRegister,
    addCamp,
    updateCamp,
    deleteCamp,
    addAccount,
    openStudentLogin,
    updateAccount,
    deleteAccount,
    getStudentCamp,
    getCampDays,
    canViewCampReport,
    isCampStarted,
    canStudentCheckIn,
    getStudentsByCamp,
    getAllStudents,
    getCoachCamps,
    getCoachStudents,
    getStudentCampId,
    getStudentCamps,
    // B2C 新增域
    interpretationRequests,
    consultThreads,
    knowledgeContents,
    activeRequestId,
    activeThreadId,
    setActiveRequestId,
    setActiveThreadId,
    submitInterpretationRequest,
    answerInterpretation,
    followupInterpretation,
    markInterpretationRead,
    getStudentInterpretations,
    getPendingInterpretations,
    askConsult,
    staffReplyConsult,
    studentReplyConsult,
    setConsultContact,
    markThreadRead,
    getStudentThreads,
    getPendingThreads,
    addKnowledgeContent,
    deleteKnowledgeContent,
    studentName,
  };
});

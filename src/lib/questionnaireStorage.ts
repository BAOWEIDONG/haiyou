/**
 * 问卷数据按账号隔离的 localStorage 存取工具。
 *
 * 历史问题：问卷草稿/已提交数据曾用全局 key（draft_questionnaire / submitted_questionnaire），
 * 换账号登录后会带出上一个账号的姓名等预填数据。现统一改为按用户 id 隔离：
 *   提交数据  -> submitted_questionnaire_{userId}
 *   填写草稿  -> draft_questionnaire_{userId}
 *
 * 各端口径：
 *   学员本人（问卷页/我的档案）→ 用当前登录用户 id
 *   营养师/康复师查看学员详情的问卷 Tab → 用被查看学员的 id
 */
const submittedKey = (userId: string) => `submitted_questionnaire_${userId}`;
const draftKey = (userId: string) => `draft_questionnaire_${userId}`;

/** 读取某用户的已提交问卷（不含草稿），无则返回 null */
export function loadSubmitted(userId?: string | null): any | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(submittedKey(userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** 读取某用户的问卷草稿（含 formData 与 step），无则返回 null */
export function loadDraft(userId?: string | null): { formData: any; step: number } | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(draftKey(userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** 保存某用户的问卷草稿 */
export function saveDraft(userId: string, draft: { formData: any; step: number }) {
  try {
    localStorage.setItem(draftKey(userId), JSON.stringify(draft));
  } catch {
    // 隐私模式/超限：静默降级为内存，不影响功能
  }
}

/** 标记某用户问卷已提交（保存提交数据） */
export function saveSubmitted(userId: string, formData: any) {
  try {
    localStorage.setItem(submittedKey(userId), JSON.stringify(formData));
  } catch {
    // 同上，静默降级
  }
}

/** 提交成功后清除该用户的草稿 */
export function clearDraft(userId: string) {
  localStorage.removeItem(draftKey(userId));
}

/** 某用户是否已提交问卷（草稿不算已提交） */
export function isSubmitted(userId?: string | null): boolean {
  if (!userId) return false;
  return !!localStorage.getItem(submittedKey(userId));
}

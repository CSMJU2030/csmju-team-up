"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { PageHeader, StatusBadge, cardClass, inputClass, primaryButtonClass, secondaryButtonClass } from "@/csmju";
import { api, ApiException, formatDate, type Me } from "@/components/api";
import type { ProjectProgress, ProjectTask } from "@/types/features";

const taskStatus: Record<ProjectTask["status"], { label: string; tone: "success" | "info" | "neutral" | "warning" }> = {
  TODO: { label: "ยังไม่เริ่ม", tone: "neutral" },
  IN_PROGRESS: { label: "กำลังทำ", tone: "info" },
  BLOCKED: { label: "ติดปัญหา", tone: "warning" },
  IN_REVIEW: { label: "รอตรวจ", tone: "info" },
  COMPLETED: { label: "เสร็จแล้ว", tone: "success" },
};

export default function ProjectProgress({ projectId }: { projectId: string }) {
  const [progress, setProgress] = useState<ProjectProgress | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const [progressData, meData] = await Promise.all([
        api<ProjectProgress>(`/api/v1/projects/${encodeURIComponent(projectId)}/progress`),
        api<Me>("/api/v1/me"),
      ]);
      setProgress(progressData); setMe(meData); setError("");
    } catch (e) { setError(e instanceof ApiException ? e.message : "โหลดความคืบหน้าไม่สำเร็จ"); }
    finally { setLoadedProjectId(projectId); setLoading(false); }
  }, [projectId]);
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api<ProjectProgress>(`/api/v1/projects/${encodeURIComponent(projectId)}/progress`),
      api<Me>("/api/v1/me"),
    ]).then(([progressData, meData]) => {
      if (!cancelled) { setProgress(progressData); setMe(meData); setError(""); }
    }).catch((cause) => {
      if (!cancelled) setError(cause instanceof ApiException ? cause.message : "โหลดความคืบหน้าไม่สำเร็จ");
    }).finally(() => {
      if (!cancelled) { setLoadedProjectId(projectId); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [projectId]);

  async function act(path: string, method: string, body?: unknown, message = "บันทึกแล้ว"): Promise<boolean> {
    setBusy(true); setError(""); setNotice("");
    try { await api(path, { method, body: body === undefined ? undefined : JSON.stringify(body) }); setNotice(message); await load(); return true; }
    catch (e) { setError(e instanceof ApiException ? e.message : "ดำเนินการไม่สำเร็จ"); return false; }
    finally { setBusy(false); }
  }

  async function createMilestone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const values = new FormData(form);
    const saved = await act(`/api/v1/projects/${projectId}/milestones`, "POST", {
      title: String(values.get("title") ?? "").trim(), description: String(values.get("description") ?? "").trim() || undefined,
      dueAt: String(values.get("dueAt") ?? "").trim() || undefined, weight: Number(values.get("weight") ?? 1),
    }, "สร้าง milestone แล้ว"); if (saved) form.reset();
  }

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const values = new FormData(form);
    const saved = await act(`/api/v1/projects/${projectId}/tasks`, "POST", {
      title: String(values.get("title") ?? "").trim(), description: String(values.get("description") ?? "").trim() || undefined,
      milestoneId: String(values.get("milestoneId") ?? "").trim() || undefined,
      assignedCoreUserId: String(values.get("assignedCoreUserId") ?? "").trim() || undefined,
      dueAt: String(values.get("dueAt") ?? "").trim() || undefined,
      workSize: String(values.get("workSize") ?? "SMALL"), weight: Number(values.get("weight") ?? 1),
    }, "สร้างงานแล้ว"); if (saved) form.reset();
  }

  async function submitTask(event: FormEvent<HTMLFormElement>, taskId: string) {
    event.preventDefault(); const form = event.currentTarget; const values = new FormData(form);
    const saved = await act(`/api/v1/projects/${projectId}/tasks/${taskId}/submissions`, "POST", {
      note: String(values.get("note") ?? "").trim(), url: String(values.get("url") ?? "").trim(),
    }, "ส่งงานรอตรวจแล้ว"); if (saved) form.reset();
  }

  if (loading || loadedProjectId !== projectId) return <section className={`${cardClass} p-8`} role="status">กำลังโหลดความคืบหน้าทีม…</section>;
  if (error) return <section className={`${cardClass} p-6`} role="alert"><PageHeader title="ไม่สามารถเปิดความคืบหน้าได้" description={error} /><button type="button" className={secondaryButtonClass} onClick={() => void load()}>ลองอีกครั้ง</button></section>;
  if (!progress) return null;

  return <div className="space-y-5">
    <PageHeader title="ความคืบหน้าทีม" description={progress.project.title} />
    {notice ? <p className="rounded-lg border border-outline-variant bg-surface-container-low p-3 text-label-md" role="status">{notice}</p> : null}
    {error ? <p className="rounded-lg border border-error/40 bg-error-container p-3 text-label-md" role="alert">{error}</p> : null}
    <section className={`${cardClass} p-5`}>
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-label-sm text-on-surface-variant">ความคืบหน้าโดยรวม</p><strong className="text-display-lg font-bold text-primary-container">{progress.progressPercent}%</strong></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><SmallStat label="งานทั้งหมด" value={progress.summary.totalTasks} /><SmallStat label="เสร็จแล้ว" value={progress.summary.completedTasks} /><SmallStat label="ติดปัญหา" value={progress.summary.blockedTasks} /><SmallStat label="เลยกำหนด" value={progress.summary.overdueTasks} /></div></div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-surface-container-high"><div className="h-full rounded-full bg-primary-container transition-all" style={{ width: `${progress.progressPercent}%` }} /></div>
    </section>

    {progress.project.isOwner ? <section className="grid gap-4 lg:grid-cols-2">
      <form onSubmit={createMilestone} className={`${cardClass} space-y-3 p-5`}><h2 className="text-headline-sm font-semibold">เพิ่ม Milestone</h2>
        <div><label htmlFor="milestone-title" className="mb-1.5 block text-label-sm font-semibold">ชื่อ milestone</label><input id="milestone-title" name="title" className={inputClass} required maxLength={160} /></div>
        <div><label htmlFor="milestone-description" className="mb-1.5 block text-label-sm font-semibold">รายละเอียด</label><textarea id="milestone-description" name="description" className={`${inputClass} min-h-20`} maxLength={2000} /></div>
        <div className="grid grid-cols-2 gap-3"><div><label htmlFor="milestone-due" className="mb-1.5 block text-label-sm font-semibold">กำหนดส่ง</label><input id="milestone-due" name="dueAt" type="date" className={inputClass} /></div><div><label htmlFor="milestone-weight" className="mb-1.5 block text-label-sm font-semibold">น้ำหนักความสำคัญ</label><input id="milestone-weight" name="weight" type="number" min={1} max={100} defaultValue={1} className={inputClass} /></div></div>
        <button className={primaryButtonClass} type="submit" disabled={busy}>สร้าง milestone</button>
      </form>
      <form onSubmit={createTask} className={`${cardClass} space-y-3 p-5`}><h2 className="text-headline-sm font-semibold">เพิ่มงานในทีม</h2>
        <div><label htmlFor="task-title" className="mb-1.5 block text-label-sm font-semibold">ชื่องาน</label><input id="task-title" name="title" className={inputClass} required maxLength={160} /></div>
        <div><label htmlFor="task-description" className="mb-1.5 block text-label-sm font-semibold">รายละเอียด / เกณฑ์รับงาน</label><textarea id="task-description" name="description" className={`${inputClass} min-h-20`} maxLength={2000} /></div>
        <div><label htmlFor="task-milestone" className="mb-1.5 block text-label-sm font-semibold">Milestone</label><select id="task-milestone" name="milestoneId" className={inputClass} defaultValue=""><option value="">ยังไม่ผูก milestone</option>{progress.milestones.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></div>
        <div><label htmlFor="task-assignee" className="mb-1.5 block text-label-sm font-semibold">ผู้รับผิดชอบ</label><select id="task-assignee" name="assignedCoreUserId" className={inputClass} required defaultValue=""><option value="" disabled>เลือกสมาชิก</option>{progress.project.teamMembers.filter((member) => !member.isOwner).map((member) => <option key={member.coreUserId} value={member.coreUserId}>สมาชิก · {member.coreUserId.slice(-8)}</option>)}</select></div>
        <div><label htmlFor="task-work-size" className="mb-1.5 block text-label-sm font-semibold">ขนาดงาน (ใช้คำนวณแต้มเมื่อผ่านตรวจ)</label><select id="task-work-size" name="workSize" className={inputClass} defaultValue="SMALL"><option value="SMALL">เล็ก · 5 แต้ม</option><option value="MEDIUM">กลาง · 10 แต้ม</option><option value="LARGE">ใหญ่ · 20 แต้ม</option></select></div>
        <div className="grid grid-cols-2 gap-3"><div><label htmlFor="task-due" className="mb-1.5 block text-label-sm font-semibold">กำหนดส่ง</label><input id="task-due" name="dueAt" type="date" className={inputClass} /></div><div><label htmlFor="task-weight" className="mb-1.5 block text-label-sm font-semibold">น้ำหนัก</label><input id="task-weight" name="weight" type="number" min={1} max={100} defaultValue={1} className={inputClass} /></div></div>
        <p className="text-label-sm text-on-surface-variant">แต้มจะมอบให้สมาชิกที่ได้รับมอบหมายเท่านั้น เมื่อเจ้าของโปรเจกต์ตรวจอนุมัติหลักฐานแล้ว</p><button className={primaryButtonClass} type="submit" disabled={busy || !progress.project.teamMembers.some((member) => !member.isOwner)}>สร้างงาน</button>
      </form>
    </section> : null}

    <section className="space-y-3"><h2 className="text-headline-md font-semibold">Milestones</h2>{progress.milestones.length ? progress.milestones.map((milestone) => <article key={milestone.id} className={`${cardClass} space-y-3 p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-headline-sm font-semibold">{milestone.title}</h3>{milestone.description ? <p className="mt-1 text-body-md text-on-surface-variant">{milestone.description}</p> : null}<p className="mt-1 text-label-sm text-on-surface-variant">{milestone.dueAt ? `กำหนดส่ง ${formatDate(milestone.dueAt)}` : "ไม่กำหนดวันส่ง"} · น้ำหนัก {milestone.weight}</p></div><StatusBadge tone={milestone.progressPercent === 100 ? "success" : milestone.status === "BLOCKED" ? "warning" : "info"} label={`${milestone.progressPercent}%`} /></div>
      {progress.project.isOwner ? <div className="flex flex-wrap items-center gap-2"><label htmlFor={`milestone-status-${milestone.id}`} className="text-label-sm font-semibold">สถานะ</label><select id={`milestone-status-${milestone.id}`} className={`${inputClass} max-w-56`} value={milestone.status} onChange={(event) => void act(`/api/v1/projects/${projectId}/milestones/${milestone.id}`, "PATCH", { status: event.target.value }, "อัปเดต milestone แล้ว")}><option value="TODO">ยังไม่เริ่ม</option><option value="IN_PROGRESS">กำลังทำ</option><option value="BLOCKED">ติดปัญหา</option><option value="COMPLETED">เสร็จแล้ว</option></select></div> : null}
      {milestone.tasks.length ? <div className="space-y-2 border-t border-outline-variant pt-3">      {milestone.tasks.map((task) => <TaskCard key={`${task.id}-${task.updatedAt}`} task={task} projectId={projectId} isOwner={progress.project.isOwner} currentCoreUserId={me?.coreUserId ?? ""} teamMembers={progress.project.teamMembers} busy={busy} onAct={act} onSubmit={submitTask} />)}</div> : <p className="text-label-sm text-on-surface-variant">ยังไม่มีงานใน milestone นี้</p>}
    </article>) : <div className={`${cardClass} p-6 text-body-md text-on-surface-variant`}>ยังไม่มี milestone {progress.project.isOwner ? "สร้าง milestone แรกเพื่อวางแผนงานของทีม" : "รอเจ้าของโปรเจกต์เพิ่มแผนงาน"}</div>}</section>

    <section className="space-y-3"><h2 className="text-headline-md font-semibold">งานอื่น ๆ</h2>{progress.tasks.filter((task) => !task.milestoneId).map((task) => <TaskCard key={`${task.id}-${task.updatedAt}`} task={task} projectId={projectId} isOwner={progress.project.isOwner} currentCoreUserId={me?.coreUserId ?? ""} teamMembers={progress.project.teamMembers} busy={busy} onAct={act} onSubmit={submitTask} />)}{!progress.tasks.some((task) => !task.milestoneId) ? <div className={`${cardClass} p-4 text-body-md text-on-surface-variant`}>ไม่มีงานที่อยู่นอก milestone</div> : null}</section>
    <section className="space-y-3"><h2 className="text-headline-md font-semibold">ประวัติความคืบหน้า</h2>{progress.events.length ? <ol className={`${cardClass} divide-y divide-outline-variant px-4`}>{progress.events.map((event) => <li key={event.id} className="py-3"><p className="text-body-md">{event.message}</p><p className="mt-1 text-label-sm text-on-surface-variant">{event.actorCoreUserId.slice(-8)} · {formatDate(event.createdAt)}</p></li>)}</ol> : <div className={`${cardClass} p-4 text-body-md text-on-surface-variant`}>ยังไม่มีประวัติความคืบหน้า</div>}</section>
  </div>;
}

function TaskCard({ task, projectId, isOwner, currentCoreUserId, teamMembers, busy, onAct, onSubmit }: {
  task: ProjectTask; projectId: string; isOwner: boolean; currentCoreUserId: string; teamMembers: Array<{ coreUserId: string; isOwner: boolean }>; busy: boolean;
  onAct: (path: string, method: string, body?: unknown, message?: string) => Promise<boolean>;
  onSubmit: (event: FormEvent<HTMLFormElement>, taskId: string) => Promise<void>;
}) {
  const canSubmit = !isOwner && task.status !== "COMPLETED" && task.assignedCoreUserId === currentCoreUserId;
  const canUpdate = task.status !== "COMPLETED" && task.status !== "IN_REVIEW" && (isOwner || task.assignedCoreUserId === currentCoreUserId);
  return <div className="rounded-lg border border-outline-variant p-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="font-semibold">{task.title}</h4>{task.description ? <p className="mt-1 whitespace-pre-wrap text-body-md text-on-surface-variant">{task.description}</p> : null}<p className="mt-1 break-all text-label-sm text-on-surface-variant">{task.assignedCoreUserId ? `ผู้รับผิดชอบ ${task.assignedCoreUserId}` : "ยังไม่ได้มอบหมาย"}{task.dueAt ? ` · กำหนดส่ง ${formatDate(task.dueAt)}` : " · ไม่กำหนดวันส่ง"} · ขนาดงาน {task.workSize === "SMALL" ? "เล็ก" : task.workSize === "MEDIUM" ? "กลาง" : "ใหญ่"}</p></div><StatusBadge tone={taskStatus[task.status].tone} label={taskStatus[task.status].label} /></div>
    {canUpdate ? <form className="mt-3 grid gap-3 border-t border-outline-variant pt-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); const values = new FormData(event.currentTarget); const nextStatus = String(values.get("status")) as ProjectTask["status"]; void onAct(`/api/v1/projects/${projectId}/tasks/${task.id}`, "PATCH", { status: nextStatus, progressNote: String(values.get("progressNote") ?? "").trim() || null, blockerNote: nextStatus === "BLOCKED" ? String(values.get("blockerNote") ?? "").trim() : null }, "อัปเดตความคืบหน้าแล้ว"); }}>
      <div><label htmlFor={`task-status-${task.id}`} className="mb-1.5 block text-label-sm font-semibold">สถานะ</label><select id={`task-status-${task.id}`} name="status" className={inputClass} defaultValue={task.status} disabled={busy}>{["TODO", "IN_PROGRESS", "BLOCKED"].map((value) => <option key={value} value={value}>{taskStatus[value as ProjectTask["status"]].label}</option>)}</select></div>
      <div><label htmlFor={`task-progress-${task.id}`} className="mb-1.5 block text-label-sm font-semibold">อัปเดตความคืบหน้า</label><input id={`task-progress-${task.id}`} name="progressNote" className={inputClass} maxLength={2000} defaultValue={task.progressNote ?? ""} disabled={busy} /></div>
      <div className="sm:col-span-2"><label htmlFor={`task-blocker-${task.id}`} className="mb-1.5 block text-label-sm font-semibold">สาเหตุที่ติดปัญหา (จำเป็นเมื่อเลือกสถานะติดปัญหา)</label><input id={`task-blocker-${task.id}`} name="blockerNote" className={inputClass} maxLength={1000} defaultValue={task.blockerNote ?? ""} disabled={busy} /></div>
      <div className="sm:col-span-2"><button type="submit" className={secondaryButtonClass} disabled={busy}>บันทึกสถานะและความคืบหน้า</button></div>
    </form> : null}
    {isOwner && task.status !== "COMPLETED" ? <div className="mt-3 flex flex-wrap items-center gap-2">
      <label htmlFor={`task-assignee-${task.id}`} className="text-label-sm font-semibold">ผู้รับผิดชอบ</label>
      <select id={`task-assignee-${task.id}`} className={`${inputClass} max-w-72`} value={task.assignedCoreUserId ?? ""} disabled={busy} onChange={(event) => void onAct(`/api/v1/projects/${projectId}/tasks/${task.id}`, "PATCH", { assignedCoreUserId: event.target.value || null }, "อัปเดตผู้รับผิดชอบแล้ว")}>
        <option value="" disabled>เลือกสมาชิก</option>{teamMembers.filter((member) => !member.isOwner).map((member) => <option key={member.coreUserId} value={member.coreUserId}>สมาชิก · {member.coreUserId.slice(-8)}</option>)}
      </select>
    </div> : null}
    {canSubmit ? <form onSubmit={(event) => void onSubmit(event, task.id)} className="mt-3 grid gap-3 border-t border-outline-variant pt-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"><div><label htmlFor={`task-note-${task.id}`} className="mb-1.5 block text-label-sm font-semibold">สรุปงานที่ส่ง</label><input id={`task-note-${task.id}`} name="note" className={inputClass} required maxLength={2000} /></div><div><label htmlFor={`task-url-${task.id}`} className="mb-1.5 block text-label-sm font-semibold">URL หลักฐาน</label><input id={`task-url-${task.id}`} name="url" type="url" className={inputClass} required placeholder="https://..." /></div><div className="flex items-end"><button disabled={busy} type="submit" className={primaryButtonClass}>ส่งตรวจ</button></div></form> : null}
    {task.submissions.length ? <div className="mt-3 space-y-2 border-t border-outline-variant pt-3"><h5 className="text-label-md font-semibold">ประวัติส่งงานล่าสุด</h5>{task.submissions.map((submission) => <div key={submission.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-container-low p-3"><div className="min-w-0"><p className="font-semibold">{submission.note}</p><p className="mt-1 break-all text-label-sm text-on-surface-variant">{submission.url || `ส่งเมื่อ ${formatDate(submission.submittedAt)}`}</p>{submission.reviewNote ? <p className="mt-1 text-label-sm text-on-surface-variant">หมายเหตุ: {submission.reviewNote}</p> : null}</div><div className="flex flex-wrap items-center gap-2"><StatusBadge tone={submission.status === "APPROVED" ? "success" : submission.status === "REJECTED" ? "warning" : "info"} label={submission.status === "APPROVED" ? "ผ่าน" : submission.status === "REJECTED" ? "ต้องแก้ไข" : "รอตรวจ"} />{isOwner && submission.status === "PENDING" ? <><button type="button" disabled={busy} className={primaryButtonClass} onClick={() => void onAct(`/api/v1/projects/${projectId}/tasks/${task.id}/submissions/${submission.id}/review`, "POST", { decision: "APPROVE" }, "อนุมัติงานแล้ว")}>อนุมัติ</button><button type="button" disabled={busy} className={secondaryButtonClass} onClick={() => void onAct(`/api/v1/projects/${projectId}/tasks/${task.id}/submissions/${submission.id}/review`, "POST", { decision: "REJECT", reviewNote: "กรุณาแก้ไขและส่งใหม่" }, "ส่งกลับให้แก้ไขแล้ว")}>ขอแก้ไข</button></> : null}</div></div>)}</div> : null}
  </div>;
}

function SmallStat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg bg-surface-container-low px-3 py-2"><strong className="block text-headline-sm">{value}</strong><span className="text-label-sm text-on-surface-variant">{label}</span></div>;
}

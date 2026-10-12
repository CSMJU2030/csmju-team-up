"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { PageHeader, StatusBadge, cardClass, inputClass, primaryButtonClass, secondaryButtonClass } from "@/csmju";
import { api, ApiException, formatDate } from "@/components/api";
import type { ContributionsMe, ContributionWork, EvidenceKind } from "@/types/features";
import type { Project } from "@/components/api";

const status: Record<ContributionWork["status"], { label: string; tone: "success" | "info" | "neutral" | "warning" }> = {
  DRAFT: { label: "ฉบับร่าง", tone: "neutral" },
  SUBMITTED: { label: "รอตรวจ", tone: "info" },
  VERIFIED: { label: "ยืนยันแล้ว", tone: "success" },
  REJECTED: { label: "ต้องแก้ไข", tone: "warning" },
};

export default function ContributionPassport() {
  const [data, setData] = useState<ContributionsMe>({ works: [], points: 0, ledger: [] });
  const [projects, setProjects] = useState<Project[]>([]);
  const [reviewQueue, setReviewQueue] = useState<ContributionWork[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const [workData, projectData, queueData] = await Promise.all([
        api<ContributionsMe>("/api/v1/contributions/me"),
        api<Project[]>("/api/v1/projects?page=1&limit=100"),
        api<ContributionWork[]>("/api/v1/contributions/review-queue"),
      ]);
      setData(workData); setProjects(projectData); setReviewQueue(queueData); setError("");
    } catch (e) { setError(e instanceof ApiException ? e.message : "โหลดข้อมูลผลงานไม่สำเร็จ"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api<ContributionsMe>("/api/v1/contributions/me"),
      api<Project[]>("/api/v1/projects?page=1&limit=100"),
      api<ContributionWork[]>("/api/v1/contributions/review-queue"),
    ]).then(([workData, projectData, queueData]) => {
      if (!cancelled) {
        setData(workData); setProjects(projectData); setReviewQueue(queueData); setError("");
      }
    }).catch((cause) => {
      if (!cancelled) setError(cause instanceof ApiException ? cause.message : "โหลดข้อมูลผลงานไม่สำเร็จ");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  async function createWork(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const formElement = event.currentTarget; setBusy(true); setError(""); setNotice("");
    const form = new FormData(formElement);
    const repositoryUrl = String(form.get("repositoryUrl") ?? "").trim();
    const demoUrl = String(form.get("demoUrl") ?? "").trim();
    const skills = String(form.get("skills") ?? "").split(",").map((item) => item.trim()).filter(Boolean);
    const payload = {
      title: String(form.get("title") ?? "").trim(), description: String(form.get("description") ?? "").trim(),
      role: String(form.get("role") ?? "").trim(), skills,
      workSize: String(form.get("workSize") ?? "SMALL"),
      projectId: String(form.get("projectId") ?? "").trim() || undefined,
      repositoryUrl: repositoryUrl || undefined, demoUrl: demoUrl || undefined,
      visibility: String(form.get("visibility") ?? "PRIVATE"),
    };
    try {
      const work = await api<ContributionWork>("/api/v1/contributions", { method: "POST", body: JSON.stringify(payload) });
      if (repositoryUrl || demoUrl) {
        await api(`/api/v1/contributions/${work.id}/submit`, { method: "POST" });
        setNotice("บันทึกผลงานและส่งตรวจแล้ว");
      } else setNotice("บันทึกฉบับร่างแล้ว — เพิ่มหลักฐานก่อนส่งตรวจ");
      formElement.reset();
      await load();
    } catch (e) { setError(e instanceof ApiException ? e.message : "บันทึกผลงานไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  async function addEvidence(event: FormEvent<HTMLFormElement>, workId: string) {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement); setBusy(true); setError("");
    try {
      await api(`/api/v1/contributions/${workId}/evidence`, { method: "POST", body: JSON.stringify({ evidenceType: String(form.get("evidenceType")) as EvidenceKind, url: String(form.get("url") ?? "").trim(), caption: String(form.get("caption") ?? "").trim() || undefined }) });
      setNotice("เพิ่มหลักฐานแล้ว"); formElement.reset(); await load();
    } catch (e) { setError(e instanceof ApiException ? e.message : "เพิ่มหลักฐานไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  async function submitWork(workId: string) {
    setBusy(true); setError("");
    try { await api(`/api/v1/contributions/${workId}/submit`, { method: "POST" }); setNotice("ส่งผลงานตรวจแล้ว"); await load(); }
    catch (e) { setError(e instanceof ApiException ? e.message : "ส่งตรวจไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  async function reviewWork(workId: string, decision: "APPROVE" | "REJECT") {
    setBusy(true); setError(""); setNotice("");
    try {
      await api(`/api/v1/contributions/${workId}/review`, { method: "POST", body: JSON.stringify({ decision, reviewNote: decision === "REJECT" ? "กรุณาเพิ่มหรือแก้ไขหลักฐานแล้วส่งตรวจใหม่" : undefined }) });
      setNotice(decision === "APPROVE" ? "ยืนยันผลงานแล้ว และบันทึกแต้มตามกติกา" : "ส่งผลงานกลับให้แก้ไขแล้ว");
      await load();
    } catch (e) { setError(e instanceof ApiException ? e.message : "ตรวจผลงานไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  return <div className="space-y-5">
    <PageHeader title="Contribution Passport" description="บันทึกสิ่งที่คุณทำจริง แนบหลักฐาน และสร้างประวัติผลงานที่ยืนยันได้" />
    <section className="grid gap-4 sm:grid-cols-3"><div className={`${cardClass} p-5`}><p className="text-label-sm text-on-surface-variant">แต้มผลงานปัจจุบัน</p><strong className="mt-2 block text-headline-lg text-primary-container">{data.points} แต้ม</strong></div><div className={`${cardClass} p-5`}><p className="text-label-sm text-on-surface-variant">ผลงานทั้งหมด</p><strong className="mt-2 block text-headline-lg">{data.works.length}</strong></div><div className={`${cardClass} p-5`}><p className="text-label-sm text-on-surface-variant">ผลงานที่ยืนยันแล้ว</p><strong className="mt-2 block text-headline-lg">{data.works.filter((item) => item.status === "VERIFIED").length}</strong></div></section>
    {notice ? <p className="rounded-lg border border-outline-variant bg-surface-container-low p-3 text-label-md" role="status">{notice}</p> : null}
    {error ? <p className="rounded-lg border border-error/40 bg-error-container p-3 text-label-md" role="alert">{error}</p> : null}
    <section className="space-y-3"><h2 className="text-headline-md font-semibold">ผลงานที่รอตรวจจากทีมของคุณ</h2>{loading ? <div className={`${cardClass} p-5`} role="status">กำลังโหลดคิวตรวจ…</div> : reviewQueue.length ? reviewQueue.map((work) => <article key={work.id} className={`${cardClass} space-y-3 p-5`}><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-headline-sm font-semibold">{work.title}</h3><p className="mt-1 text-label-sm text-on-surface-variant">ผู้ส่ง: {work.coreUserId?.slice(-8) ?? "สมาชิก"} · {work.project?.title ?? "ผลงานส่วนตัว"}</p></div><StatusBadge tone="info" label="รอตรวจ" /></div><p className="whitespace-pre-wrap text-body-md text-on-surface-variant">{work.description}</p><p className="text-label-sm text-on-surface-variant">บทบาท: {work.role} · ขนาดงาน: {work.workSize === "SMALL" ? "เล็ก" : work.workSize === "MEDIUM" ? "กลาง" : "ใหญ่"}</p><div className="flex flex-wrap gap-2">{work.repositoryUrl ? <a className={secondaryButtonClass} href={work.repositoryUrl} target="_blank" rel="noreferrer">Repository</a> : null}{work.demoUrl ? <a className={secondaryButtonClass} href={work.demoUrl} target="_blank" rel="noreferrer">Demo</a> : null}{work.evidence.map((item) => <a key={item.id} className={secondaryButtonClass} href={item.url} target="_blank" rel="noreferrer">{item.caption || item.evidenceType}</a>)}</div><div className="flex flex-wrap justify-end gap-2"><button type="button" disabled={busy} className={secondaryButtonClass} onClick={() => void reviewWork(work.id, "REJECT")}>ขอแก้ไข</button><button type="button" disabled={busy} className={primaryButtonClass} onClick={() => void reviewWork(work.id, "APPROVE")}>ยืนยันและให้แต้ม</button></div></article>) : <div className={`${cardClass} p-5 text-body-md text-on-surface-variant`}>ไม่มีผลงานที่รอตรวจสำหรับโปรเจกต์ที่คุณมีสิทธิ์ตรวจ</div>}</section>
    <section className={`${cardClass} p-5 md:p-6`}><h2 className="text-headline-md font-semibold">เพิ่มผลงาน</h2><p className="mt-1 text-body-md text-on-surface-variant">ผลงานจะได้แต้มหลังผู้มีสิทธิ์ตรวจและยืนยันเท่านั้น</p>
      <form onSubmit={createWork} className="mt-4 grid gap-4 md:grid-cols-2">
        <div><label htmlFor="work-title" className="mb-1.5 block text-label-sm font-semibold">ชื่อผลงาน</label><input id="work-title" name="title" required maxLength={160} className={inputClass} /></div>
        <div><label htmlFor="work-role" className="mb-1.5 block text-label-sm font-semibold">บทบาทที่ทำ</label><input id="work-role" name="role" required maxLength={120} className={inputClass} placeholder="เช่น Backend Developer" /></div>
        <div><label htmlFor="work-project" className="mb-1.5 block text-label-sm font-semibold">โปรเจกต์ที่เกี่ยวข้อง (ถ้ามี)</label><select id="work-project" name="projectId" className={inputClass} defaultValue=""><option value="">ผลงานส่วนตัว / ไม่ผูกโปรเจกต์</option>{projects.filter((p) => p.owner.isCurrentUser || p.members.some((m) => m.isCurrentUser)).map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select></div>
        <div><label htmlFor="work-size" className="mb-1.5 block text-label-sm font-semibold">ขนาดงานสำหรับแต้ม</label><select id="work-size" name="workSize" className={inputClass} defaultValue="SMALL"><option value="SMALL">เล็ก · 5 แต้มเมื่อยืนยัน</option><option value="MEDIUM">กลาง · 10 แต้มเมื่อยืนยัน</option><option value="LARGE">ใหญ่ · 20 แต้มเมื่อยืนยัน</option></select></div>
        <div className="md:col-span-2"><label htmlFor="work-description" className="mb-1.5 block text-label-sm font-semibold">รายละเอียด contribution</label><textarea id="work-description" name="description" required maxLength={3000} className={`${inputClass} min-h-24`} placeholder="คุณรับผิดชอบอะไร ส่งมอบอะไร และผลลัพธ์คืออะไร" /></div>
        <div><label htmlFor="work-skills" className="mb-1.5 block text-label-sm font-semibold">ทักษะที่ใช้</label><input id="work-skills" name="skills" className={inputClass} placeholder="React, API, Testing" /></div>
        <div><label htmlFor="work-visibility" className="mb-1.5 block text-label-sm font-semibold">การแสดงผลงานหลังยืนยัน</label><select id="work-visibility" name="visibility" className={inputClass} defaultValue="PRIVATE"><option value="PRIVATE">ส่วนตัว</option><option value="TEAM">สมาชิกโปรเจกต์</option><option value="PUBLIC">สาธารณะ</option></select></div>
        <div><label htmlFor="work-repository" className="mb-1.5 block text-label-sm font-semibold">Repository URL (ถ้ามี)</label><input id="work-repository" name="repositoryUrl" type="url" className={inputClass} placeholder="https://github.com/..." /></div>
        <div><label htmlFor="work-demo" className="mb-1.5 block text-label-sm font-semibold">Demo URL (ถ้ามี)</label><input id="work-demo" name="demoUrl" type="url" className={inputClass} placeholder="https://..." /></div>
        <div className="flex justify-end md:col-span-2"><button disabled={busy} className={primaryButtonClass} type="submit">บันทึกผลงาน</button></div>
      </form>
    </section>
    <section className="space-y-3"><h2 className="text-headline-md font-semibold">ผลงานของฉัน</h2>
      {loading ? <div role="status" className={`${cardClass} p-6`}>กำลังโหลดผลงาน…</div> : data.works.length === 0 ? <div className={`${cardClass} p-6 text-body-md text-on-surface-variant`}>ยังไม่มีผลงาน เริ่มจากบันทึก contribution แรกของคุณ</div> : data.works.map((work) => <article key={work.id} className={`${cardClass} space-y-3 p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-headline-sm font-semibold">{work.title}</h3><p className="mt-1 text-label-sm text-on-surface-variant">{work.project?.title ?? "ผลงานส่วนตัว"} · สร้าง {formatDate(work.createdAt)}</p></div><StatusBadge tone={status[work.status].tone} label={status[work.status].label} /></div>
        <p className="whitespace-pre-wrap text-body-md text-on-surface-variant">{work.description}</p><div className="flex flex-wrap gap-2">{work.skills.map((item) => <span key={item} className="rounded-lg border border-outline-variant px-2 py-1 text-label-sm">{item}</span>)}</div>
        {work.reviewNote ? <p className="rounded-lg bg-surface-container-low p-3 text-body-md" role="status">หมายเหตุผู้ตรวจ: {work.reviewNote}</p> : null}
        <div className="flex flex-wrap gap-2">{work.repositoryUrl ? <a className={secondaryButtonClass} href={work.repositoryUrl} target="_blank" rel="noreferrer">Repository</a> : null}{work.demoUrl ? <a className={secondaryButtonClass} href={work.demoUrl} target="_blank" rel="noreferrer">Demo</a> : null}{work.pointTransactions.map((txn) => <StatusBadge key={txn.id} tone="success" label={`+${txn.points} แต้ม`} />)}</div>
        {work.evidence.length ? <div className="space-y-1"><p className="text-label-sm font-semibold">หลักฐาน</p>{work.evidence.map((item) => <a key={item.id} className="block break-all text-label-sm text-primary underline" href={item.url} target="_blank" rel="noreferrer">{item.caption || item.evidenceType}: {item.url}</a>)}</div> : null}
        {work.status === "DRAFT" || work.status === "REJECTED" ? <div className="grid gap-3 border-t border-outline-variant pt-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <form onSubmit={(event) => void addEvidence(event, work.id)} className="contents">
            <div><label htmlFor={`evidence-type-${work.id}`} className="mb-1.5 block text-label-sm font-semibold">ประเภทหลักฐาน</label><select id={`evidence-type-${work.id}`} name="evidenceType" className={inputClass} defaultValue="OTHER"><option value="REPOSITORY">Repository</option><option value="DEMO">Demo</option><option value="DOCUMENT">เอกสาร</option><option value="OTHER">อื่น ๆ</option></select></div>
            <div><label htmlFor={`evidence-url-${work.id}`} className="mb-1.5 block text-label-sm font-semibold">URL หลักฐาน</label><input id={`evidence-url-${work.id}`} name="url" type="url" required className={inputClass} placeholder="https://..." /></div>
            <div className="flex flex-wrap items-end gap-2"><button disabled={busy} type="submit" className={secondaryButtonClass}>เพิ่มหลักฐาน</button><button disabled={busy} type="button" className={primaryButtonClass} onClick={() => void submitWork(work.id)}>ส่งตรวจ</button></div>
          </form>
        </div> : null}
      </article>)}
    </section>
    <section className="space-y-3"><h2 className="text-headline-md font-semibold">ประวัติแต้ม</h2>{data.ledger.length ? <div className={`${cardClass} divide-y divide-outline-variant`}>{data.ledger.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-semibold">{item.reason}</p><p className="mt-1 text-label-sm text-on-surface-variant">{formatDate(item.createdAt)}</p></div><strong className={item.points < 0 ? "text-error" : "text-primary-container"}>{item.points > 0 ? "+" : ""}{item.points}</strong></div>)}</div> : <div className={`${cardClass} p-5 text-body-md text-on-surface-variant`}>ยังไม่มีรายการแต้ม — แต้มจะเกิดหลังผลงานผ่านการตรวจเท่านั้น</div>}</section>
  </div>;
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader, StatusBadge, cardClass, secondaryButtonClass } from "@/csmju";
import { api, ApiException } from "@/components/api";

type PublicWork = {
  id: string; title: string; description: string; role: string; skills: string[];
  repositoryUrl: string | null; demoUrl: string | null; verifiedAt: string | null;
  evidence: Array<{ id: string; evidenceType: string; url: string; caption: string | null }>;
  project: { id: string; title: string; status: string } | null;
};
type PublicProfileData = {
  coreUserId: string; bio: string | null; skills: string[]; githubUrl: string | null; linkedinUrl: string | null;
  isAvailable: boolean; isCurrentUser: boolean; points?: number; profileViewsLast30Days?: number; contributions: PublicWork[];
};

export default function PublicProfile({ coreUserId }: { coreUserId: string }) {
  const [result, setResult] = useState<{ coreUserId: string; profile?: PublicProfileData; error?: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    api<PublicProfileData>(`/api/v1/community/profiles/${encodeURIComponent(coreUserId)}`)
      .then((profile) => { if (!cancelled) setResult({ coreUserId, profile }); })
      .catch((e) => { if (!cancelled) setResult({ coreUserId, error: e instanceof ApiException ? e.message : "โหลดโปรไฟล์ไม่สำเร็จ" }); });
    return () => { cancelled = true; };
  }, [coreUserId]);

  if (!result || result.coreUserId !== coreUserId) return <section className={`${cardClass} p-8`} role="status">กำลังโหลดโปรไฟล์…</section>;
  const profile = result.profile;
  if (result.error || !profile) return <section className={`${cardClass} p-6`} role="alert"><PageHeader title="ไม่สามารถเปิดโปรไฟล์ได้" description={result.error || "โปรไฟล์นี้ไม่มีอยู่หรือเจ้าของไม่ได้เปิดเผยข้อมูล"} /><Link className={secondaryButtonClass} href="/people">กลับไปค้นหาสมาชิก</Link></section>;

  return <div className="space-y-5">
    <PageHeader title={`โปรไฟล์สมาชิก · ${profile.coreUserId.slice(-8)}`} description="แสดงเฉพาะข้อมูลและผลงานที่เจ้าของเลือกเปิดเผย" />
    <section className={`${cardClass} p-5 md:p-6`}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><StatusBadge tone={profile.isAvailable ? "success" : "neutral"} label={profile.isAvailable ? "พร้อมร่วมทีม" : "ไม่ว่าง"} /><h2 className="mt-3 text-headline-md font-semibold">สมาชิก CS TeamUp</h2></div>{profile.points !== undefined ? <div className="rounded-xl bg-primary-container/10 px-4 py-3 text-right"><span className="block text-label-sm text-on-surface-variant">แต้มผลงาน</span><strong className="text-headline-md text-primary-container">{profile.points}</strong></div> : null}</div>
      <p className="mt-3 whitespace-pre-wrap text-body-md text-on-surface-variant">{profile.bio || "ยังไม่ได้เพิ่มคำแนะนำตัว"}</p>
      <div className="mt-4 flex flex-wrap gap-2">{profile.skills.map((skill) => <span key={skill} className="rounded-lg border border-outline-variant bg-surface px-2.5 py-1 text-label-sm">{skill}</span>)}</div>
      <div className="mt-5 flex flex-wrap gap-2">{profile.githubUrl ? <a className={secondaryButtonClass} href={profile.githubUrl} target="_blank" rel="noreferrer">GitHub</a> : null}{profile.linkedinUrl ? <a className={secondaryButtonClass} href={profile.linkedinUrl} target="_blank" rel="noreferrer">LinkedIn</a> : null}{profile.isCurrentUser && profile.profileViewsLast30Days !== undefined ? <StatusBadge tone="info" label={`ผู้เข้าชม 30 วัน ${profile.profileViewsLast30Days}`} /> : null}</div>
    </section>
    <section className="space-y-3"><h2 className="text-headline-md font-semibold">ผลงานที่ยืนยันแล้ว</h2>{profile.contributions.length ? profile.contributions.map((work) => <article key={work.id} className={`${cardClass} p-5`}>
      <div className="flex flex-wrap items-center gap-2"><StatusBadge tone="success" label="ยืนยันผลงานแล้ว" />{work.project ? <StatusBadge tone="neutral" label={work.project.title} /> : null}</div>
      <h3 className="mt-3 text-headline-sm font-semibold">{work.title}</h3><p className="mt-2 whitespace-pre-wrap text-body-md text-on-surface-variant">{work.description}</p><p className="mt-2 text-label-sm text-on-surface-variant">บทบาท: {work.role}</p>
      <div className="mt-3 flex flex-wrap gap-2">{work.skills.map((skill) => <span key={skill} className="rounded-lg border border-outline-variant px-2 py-1 text-label-sm">{skill}</span>)}</div>
      <div className="mt-4 flex flex-wrap gap-2">{work.repositoryUrl ? <a className={secondaryButtonClass} href={work.repositoryUrl} target="_blank" rel="noreferrer">Repository</a> : null}{work.demoUrl ? <a className={secondaryButtonClass} href={work.demoUrl} target="_blank" rel="noreferrer">Demo</a> : null}{work.evidence.map((evidence) => <a key={evidence.id} className={secondaryButtonClass} href={evidence.url} target="_blank" rel="noreferrer">{evidence.caption || evidence.evidenceType}</a>)}</div>
    </article>) : <div className={`${cardClass} p-6 text-body-md text-on-surface-variant`}>ยังไม่มีผลงานที่ยืนยันและเปิดเผยสาธารณะ</div>}</section>
  </div>;
}

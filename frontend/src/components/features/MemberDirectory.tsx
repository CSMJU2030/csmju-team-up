"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeader, StatusBadge, cardClass, inputClass, primaryButtonClass, secondaryButtonClass } from "@/csmju";
import { api, ApiException } from "@/components/api";
import type { MemberDirectoryProfile } from "@/types/features";

export default function MemberDirectory() {
  const [query, setQuery] = useState("");
  const [skill, setSkill] = useState("");
  const [members, setMembers] = useState<MemberDirectoryProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (q: string, s: string) => {
    const params = new URLSearchParams({ page: "1", limit: "50" });
    if (q.trim()) params.set("q", q.trim());
    if (s.trim()) params.set("skill", s.trim());
    try { setMembers(await api<MemberDirectoryProfile[]>(`/api/v1/community/profiles?${params.toString()}`)); setError(""); }
    catch (e) { setError(e instanceof ApiException ? e.message : "โหลดรายชื่อสมาชิกไม่สำเร็จ"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    let cancelled = false;
    api<MemberDirectoryProfile[]>("/api/v1/community/profiles?page=1&limit=50")
      .then((profiles) => { if (!cancelled) { setMembers(profiles); setError(""); } })
      .catch((cause) => { if (!cancelled) setError(cause instanceof ApiException ? cause.message : "โหลดรายชื่อสมาชิกไม่สำเร็จ"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return <div className="space-y-5">
    <PageHeader title="ค้นหาสมาชิก" description="ค้นหาเพื่อนร่วมทีมจากโปรไฟล์ที่เจ้าของเลือกเปิดเผยใน CS TeamUp" />
    <form onSubmit={(event) => { event.preventDefault(); setLoading(true); setError(""); void load(query, skill); }} className={`${cardClass} grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,0.6fr)_auto] md:items-end`}>
      <div><label htmlFor="member-query" className="mb-1.5 block text-label-sm font-semibold">ค้นหาทักษะหรือคำแนะนำตัว</label><input id="member-query" className={inputClass} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="เช่น React, backend, UI/UX" /></div>
      <div><label htmlFor="member-skill" className="mb-1.5 block text-label-sm font-semibold">Skill ที่ต้องการ</label><input id="member-skill" className={inputClass} value={skill} onChange={(e) => setSkill(e.target.value)} placeholder="เช่น Python" /></div>
      <div className="flex gap-2"><button type="submit" className={primaryButtonClass}>ค้นหา</button><button type="button" className={secondaryButtonClass} onClick={() => { setQuery(""); setSkill(""); void load("", ""); }}>ล้าง</button></div>
    </form>
    {loading ? <section className={`${cardClass} p-8`} role="status">กำลังโหลดโปรไฟล์สมาชิก…</section> : null}
    {!loading && error ? <section className={`${cardClass} p-5`} role="alert"><p className="font-semibold">โหลดข้อมูลไม่สำเร็จ</p><p className="mt-1 text-body-md text-on-surface-variant">{error}</p><button type="button" className={`${secondaryButtonClass} mt-3`} onClick={() => { setLoading(true); setError(""); void load(query, skill); }}>ลองอีกครั้ง</button></section> : null}
    {!loading && !error && members.length === 0 ? <section className={`${cardClass} p-8`}><h2 className="font-semibold">ยังไม่พบโปรไฟล์ที่เปิดให้ค้นหา</h2><p className="mt-1 text-body-md text-on-surface-variant">สมาชิกต้องเปิดการค้นพบในหน้าโปรไฟล์ก่อนจึงจะปรากฏที่นี่</p></section> : null}
    {!loading && !error && members.length > 0 ? <section className="grid gap-4 md:grid-cols-2">{members.map((member) => <article key={member.coreUserId} className={`${cardClass} flex min-w-0 flex-col p-5`}>
      <div className="flex flex-wrap items-center gap-2"><StatusBadge tone={member.isAvailable ? "success" : "neutral"} label={member.isAvailable ? "พร้อมร่วมทีม" : "ไม่ว่าง"} />{member.isCurrentUser ? <StatusBadge tone="info" label="คุณ" /> : null}</div>
      <h2 className="mt-3 break-all text-headline-md font-semibold">สมาชิก · {member.coreUserId.slice(-8)}</h2>
      <p className="mt-2 whitespace-pre-wrap text-body-md text-on-surface-variant">{member.bio || "ยังไม่ได้เพิ่มคำแนะนำตัว"}</p>
      <div className="mt-3 flex flex-wrap gap-2">{member.skills.map((item) => <span key={item} className="rounded-lg border border-outline-variant bg-surface px-2.5 py-1 text-label-sm">{item}</span>)}</div>
      <div className="mt-4 flex flex-wrap gap-3 text-label-sm text-on-surface-variant"><span>ผลงานยืนยันแล้ว {member.verifiedContributionCount}</span>{member.points !== undefined ? <span>{member.points} แต้มผลงาน</span> : null}</div>
      <div className="mt-5 flex flex-wrap gap-2">{member.githubUrl ? <a className={secondaryButtonClass} href={member.githubUrl} target="_blank" rel="noreferrer">GitHub</a> : null}{member.linkedinUrl ? <a className={secondaryButtonClass} href={member.linkedinUrl} target="_blank" rel="noreferrer">LinkedIn</a> : null}<Link className={`${primaryButtonClass} ml-auto`} href={`/people/${encodeURIComponent(member.coreUserId)}`}>ดูโปรไฟล์</Link></div>
    </article>)}</section> : null}
  </div>;
}

"use client";

import { useState } from "react";
import { PageHeader, StatusBadge, Tabs, cardClass, inputClass, primaryButtonClass, secondaryButtonClass } from "@/csmju";

const tabs = [
  { id: "all", label: "ทั้งหมด", count: 12 },
  { id: "recommended", label: "แนะนำให้ฉัน", count: 5 },
  { id: "follow", label: "ที่ติดตาม", count: 3 },
  { id: "mine", label: "ของฉัน", count: 2 },
] as const;

type TabId = (typeof tabs)[number]["id"];

const projects = [
  { title: "CS TeamUp — Project Collaborator Finder", kind: "งานรายวิชา", status: "กำลังหาคน", tone: "success" as const, match: "ตรง 82%", meta: "ผสม (Hybrid) · 1 เทอม · CS 401 · 2/4 คน", skills: ["Frontend", "Backend", "React", "Node.js"] },
  { title: "ระบบแนะนำงานฝึกสหกิจ", kind: "โปรเจกต์จบ", status: "กำลังหาคน", tone: "success" as const, match: "ตรง 74%", meta: "ออนไลน์ · 2 เทอม · 2/3 คน", skills: ["Data", "Frontend", "Python", "React"] },
  { title: "แอปติดตามงบส่วนตัว", kind: "ส่วนตัว / แข่งขัน", status: "กำลังหาคน", tone: "success" as const, match: "", meta: "ออนไลน์ · ไม่กำหนด · 1/2 คน", skills: ["UI/UX", "Mobile", "Flutter"] },
  { title: "เว็บไซต์จองห้องประชุมสาขา", kind: "งานรายวิชา", status: "เสร็จสมบูรณ์", tone: "neutral" as const, match: "", meta: "ออนไซต์ · 1 เทอม · CS 210 · 2/2 คน", skills: ["Backend", "Node.js"] },
];

export default function PreviewPage() {
  const [active, setActive] = useState<TabId>("all");
  return (
    <div className="space-y-5">
      <PageHeader title="ตัวอย่างหน้าตา CS TeamUp" description="หน้า preview สำหรับดู visual direction ของระบบตาม CSMJU2030 Standards 1.8.4" />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary-container/20 bg-primary-container/5 p-4">
        <div>
          <p className="text-label-md font-semibold text-primary-container">UI Preview</p>
          <p className="mt-1 text-label-sm text-on-surface-variant">หน้านี้เป็นข้อมูลตัวอย่าง ไม่แตะ authentication และไม่ใช้ localStorage</p>
        </div>
        <button type="button" className={secondaryButtonClass}>ตัวอย่างปุ่มมาตรฐาน</button>
      </div>

      <div className="flex flex-wrap gap-3 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-sm">
        <div className="min-w-72 flex-1">
          <label htmlFor="preview-search" className="mb-1.5 block text-label-sm font-semibold">ค้นหา</label>
          <input id="preview-search" className={inputClass} placeholder="ชื่อโปรเจกต์, Skill, ตำแหน่ง..." />
        </div>
        <div className="min-w-48">
          <label htmlFor="preview-kind" className="mb-1.5 block text-label-sm font-semibold">ประเภท</label>
          <select id="preview-kind" className={inputClass} defaultValue=""><option value="">ทุกประเภท</option><option>งานรายวิชา</option><option>โปรเจกต์จบ</option></select>
        </div>
        <div className="min-w-48">
          <label htmlFor="preview-status" className="mb-1.5 block text-label-sm font-semibold">สถานะ</label>
          <select id="preview-status" className={inputClass} defaultValue=""><option value="">ทุกสถานะ</option><option>กำลังหาคน</option><option>กำลังพัฒนา</option><option>เสร็จสมบูรณ์</option></select>
        </div>
        <div className="flex items-end">
          <button type="button" className={primaryButtonClass}>＋ สร้างโปรเจกต์</button>
        </div>
      </div>

      <Tabs tabs={tabs.map((tab) => ({ id: tab.id, label: tab.label, count: tab.count }))} active={active} onChange={setActive} />

      <div className="grid gap-5 md:grid-cols-2">
        {projects.map((project) => (
          <article key={project.title} className={`${cardClass} p-5`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary-container/10 px-2.5 py-1 text-label-sm text-primary-container">{project.kind}</span>
              <StatusBadge tone={project.tone} label={project.status} />
              {project.match ? <StatusBadge tone="success" label={project.match} /> : null}
            </div>
            <h2 className="mt-4 text-headline-md font-semibold text-on-surface">{project.title}</h2>
            <p className="mt-2 text-body-md text-on-surface-variant">{project.meta} · เจ้าของ ก้อง</p>
            <p className="mt-3 text-body-md leading-6 text-on-surface">ระบบหาเพื่อนร่วมทีมและโปรเจกต์เพื่อสะสมผลงาน ทำงานร่วมกันเป็นทีม และจัดการ workflow ตั้งแต่สมัครจนจบโปรเจกต์</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {project.skills.map((skill) => <span key={skill} className="rounded-lg border border-outline-variant bg-surface px-2.5 py-1 text-label-sm text-on-surface-variant">{skill}</span>)}
            </div>
            <div className="mt-5 flex items-center justify-between gap-3 border-t border-outline-variant/50 pt-4">
              <span className="text-label-sm text-on-surface-variant">★ 4.8 · 5 รีวิว</span>
              <button type="button" className={secondaryButtonClass}>ดูรายละเอียด</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

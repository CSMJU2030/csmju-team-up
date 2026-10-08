"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import {
  AddIcon,
  CheckIcon,
  DeleteIcon,
  EditIcon,
  MessageIcon,
  NotificationsIcon,
  SearchIcon,
  StarIcon,
} from "@/csmju";
import { ConfirmDeleteModal, Modal, PageHeader, StatusBadge, Tabs, cardClass, dangerButtonClass, inputClass, primaryButtonClass, secondaryButtonClass } from "@/csmju";
import type { Project, Me, Profile, Notification, Conversation } from "./api";
import { api, ApiException, formatDate } from "./api";

const kindLabel: Record<Project["kind"], string> = {
  COURSE: "งานรายวิชา",
  SENIOR_PROJECT: "โปรเจกต์จบ",
  PERSONAL_COMPETITION: "ส่วนตัว / แข่งขัน",
};
const formatLabel: Record<Project["format"], string> = { ONLINE: "ออนไลน์", ONSITE: "ออนไซต์", HYBRID: "ผสม" };
const statusLabel: Record<Project["status"], string> = {
  RECRUITING: "กำลังหาคน",
  IN_PROGRESS: "กำลังพัฒนา",
  COMPLETED: "เสร็จสมบูรณ์",
};
const statusTone: Record<Project["status"], "success" | "info" | "neutral"> = {
  RECRUITING: "success",
  IN_PROGRESS: "info",
  COMPLETED: "neutral",
};

type View = "projects" | "dashboard" | "messages" | "profile";
type Tab = "all" | "recommended" | "follow" | "mine";

export default function TeamUpApp() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const view: View = pathname === "/dashboard" ? "dashboard" : pathname === "/messages" ? "messages" : pathname === "/profile" ? "profile" : "projects";

  const [projects, setProjects] = useState<Project[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [profile, setProfile] = useState<Profile>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState("");
  const [format, setFormat] = useState("");
  const [skill, setSkill] = useState("");
  const [selected, setSelected] = useState<Project | null>(null);
  const [editing, setEditing] = useState<Project | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messageTarget, setMessageTarget] = useState("");
  const [messageText, setMessageText] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (params.get("action") === "create") setShowCreate(true);
  }, [params]);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setErrorText("");
    try {
      const [meData, projectData, profileData, notificationData, conversationData] = await Promise.all([
        api<Me>("/api/v1/me"),
        api<Project[]>("/api/v1/projects?page=1&limit=100"),
        api<Profile>("/api/v1/profile"),
        api<Notification[]>("/api/v1/notifications"),
        api<Conversation[]>("/api/v1/conversations"),
      ]);
      setMe(meData);
      setProjects(projectData);
      setProfile(profileData);
      setNotifications(notificationData);
      setConversations(conversationData);
    } catch (error) {
      if (error instanceof ApiException && error.code !== "UNAUTHORIZED") setErrorText(error.message);
    } finally {
      setLoading(false);
    }
  }

  function flash(text: string) {
    setToast(text);
    window.setTimeout(() => setToast(""), 4000);
  }

  async function act(path: string, method = "POST", body?: unknown, success = "บันทึกแล้ว") {
    setBusy(true);
    try {
      await api(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
      flash(success);
      await load();
    } catch (error) {
      flash(error instanceof Error ? error.message : "ดำเนินการไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  const skills = useMemo(() => [...new Set(projects.flatMap((p) => p.skills))].sort(), [projects]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects
      .filter((p) => {
        if (tab === "mine" && !p.owner.isCurrentUser) return false;
        if (tab === "follow" && !p.isFollowing) return false;
        if (tab === "recommended") {
          if (p.owner.isCurrentUser || p.status !== "RECRUITING" || !profile?.skills?.length) return false;
          const overlap = p.skills.some((x) => profile.skills.some((s) => s.toLowerCase() === x.toLowerCase()));
          if (!overlap) return false;
        }
        if (status && p.status !== status) return false;
        if (kind && p.kind !== kind) return false;
        if (format && p.format !== format) return false;
        if (skill && !p.skills.includes(skill)) return false;
        if (q && ![p.title, p.description, p.roles.join(" "), p.skills.join(" "), p.courseCode ?? ""].join(" ").toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => (tab === "recommended" ? recommendationScore(b) - recommendationScore(a) : b.createdAt.localeCompare(a.createdAt)));
  }, [projects, tab, status, kind, format, skill, query, profile]);

  function recommendationScore(project: Project) {
    if (!profile?.skills?.length) return 0;
    const wanted = new Set(profile.skills.map((x) => x.toLowerCase()));
    return project.skills.filter((x) => wanted.has(x.toLowerCase())).length;
  }

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = projectPayload(form);
    setBusy(true);
    try {
      await api<Project>("/api/v1/projects", { method: "POST", body: JSON.stringify(payload) });
      flash("สร้างโปรเจกต์แล้ว");
      setShowCreate(false);
      router.replace("/");
      await load();
    } catch (error) {
      flash(error instanceof Error ? error.message : "สร้างโปรเจกต์ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function updateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    await act(`/api/v1/projects/${editing.id}`, "PATCH", projectPayload(form), "อัปเดตโปรเจกต์แล้ว");
    setEditing(null);
    const refreshed = await api<Project>(`/api/v1/projects/${editing.id}`);
    setSelected(refreshed);
  }

  function projectPayload(form: FormData) {
    const split = (value: FormDataEntryValue | null) => String(value ?? "").split(",").map((x) => x.trim()).filter(Boolean);
    return {
      title: String(form.get("title") ?? "").trim(),
      kind: String(form.get("kind")),
      courseCode: String(form.get("courseCode") ?? "").trim() || undefined,
      size: Number(form.get("size")),
      duration: String(form.get("duration") ?? "").trim() || undefined,
      format: String(form.get("format")),
      description: String(form.get("description") ?? "").trim(),
      roles: split(form.get("roles")),
      skills: split(form.get("skills")),
      contactText: String(form.get("contactText") ?? "").trim() || undefined,
    };
  }

  async function sendMessage(conversationId: string) {
    if (!messageText.trim()) return;
    await act(`/api/v1/conversations/${conversationId}/messages`, "POST", { body: messageText.trim() }, "ส่งข้อความแล้ว");
    setMessageText("");
  }

  async function createConversation() {
    if (!messageTarget.trim()) return;
    try {
      const conversation = await api<Conversation>("/api/v1/conversations", { method: "POST", body: JSON.stringify({ otherCoreUserId: messageTarget.trim() }) });
      setConversations((items) => [conversation, ...items.filter((item) => item.id !== conversation.id)]);
      setSelectedConversationId(conversation.id);
      setMessageTarget("");
      flash("เปิดบทสนทนาแล้ว");
    } catch (error) {
      flash(error instanceof Error ? error.message : "เปิดบทสนทนาไม่สำเร็จ");
    }
  }

  const unread = notifications.filter((item) => !item.isRead).length;
  const pendingApplications = projects.filter((p) => p.owner.isCurrentUser).reduce((sum, p) => sum + p.applications.filter((a) => a.status === "PENDING").length, 0);
  const acceptedMemberships = projects.filter((p) => p.members.some((m) => m.isCurrentUser && !p.owner.isCurrentUser)).length;

  if (loading) return <LoadingState />;
  if (errorText) return <ErrorState message={errorText} onRetry={() => void load()} />;

  return (
    <div className="space-y-6">
      {view === "projects" ? (
        <ProjectsView />
      ) : view === "dashboard" ? (
        <DashboardView />
      ) : view === "messages" ? (
        <MessagesView />
      ) : (
        <ProfileView />
      )}

      <div aria-live="polite" className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
        {toast ? <div className="rounded-lg bg-on-surface px-4 py-2.5 text-label-md text-white shadow-xl">{toast}</div> : null}
      </div>

      {showCreate ? <CreateModal onClose={() => { setShowCreate(false); if (params.get("action")) router.replace(view === "projects" ? "/" : `/${view}`); }} onSubmit={createProject} busy={busy} /> : null}
      {editing ? <EditProjectModal project={editing} onClose={() => setEditing(null)} onSubmit={updateProject} busy={busy} /> : null}
      {selected ? <ProjectModal project={selected} me={me} busy={busy} onClose={() => setSelected(null)} onEdit={() => { setEditing(selected); setSelected(null); }} onAction={act} /> : null}
      {showNotifications ? <NotificationsModal items={notifications} onClose={() => setShowNotifications(false)} onRead={(id) => void act(`/api/v1/notifications/${id}/read`, "POST", undefined, "อ่านการแจ้งเตือนแล้ว")} /> : null}
    </div>
  );

  function ProjectsView() {
    return (
      <>
        <PageHeader title="ค้นหาโปรเจกต์" description="ค้นหาโปรเจกต์ที่เหมาะกับ Skill ของคุณ แล้วสร้างทีมให้ครบก่อนเริ่มงาน" />
        <section className={`${cardClass} p-4 md:p-5`} aria-label="ตัวกรองโปรเจกต์">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1.8fr)_repeat(3,minmax(0,1fr))]">
            <div>
              <label htmlFor="project-search" className="mb-1.5 block text-label-sm font-semibold">ค้นหา</label>
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" />
                <input id="project-search" value={query} onChange={(e) => setQuery(e.target.value)} className={`${inputClass} pl-9`} placeholder="ชื่อโปรเจกต์, Skill, ตำแหน่ง..." />
              </div>
            </div>
            <FilterSelect id="kind-filter" label="ประเภท" value={kind} onChange={setKind} options={["COURSE", "SENIOR_PROJECT", "PERSONAL_COMPETITION"]} labels={kindLabel} />
            <FilterSelect id="format-filter" label="รูปแบบ" value={format} onChange={setFormat} options={["ONLINE", "ONSITE", "HYBRID"]} labels={formatLabel} />
            <FilterSelect id="status-filter" label="สถานะ" value={status} onChange={setStatus} options={["RECRUITING", "IN_PROGRESS", "COMPLETED"]} labels={statusLabel} />
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="min-w-48">
              <label htmlFor="skill-filter" className="mb-1.5 block text-label-sm font-semibold">Skill</label>
              <select id="skill-filter" value={skill} onChange={(e) => setSkill(e.target.value)} className={inputClass}>
                <option value="">ทุก Skill</option>
                {skills.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
            <button type="button" className={secondaryButtonClass} onClick={() => { setQuery(""); setKind(""); setFormat(""); setStatus(""); setSkill(""); }}>ล้างตัวกรอง</button>
            <div className="ml-auto flex items-center gap-2">
              <button type="button" aria-label="การแจ้งเตือน" className="relative rounded-lg border border-outline-variant px-3 py-2.5 text-on-surface-variant hover:bg-surface-variant/50" onClick={() => setShowNotifications(true)}>
                <NotificationsIcon className="h-5 w-5" />
                {unread ? <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-error px-1 text-center text-caption text-white">{unread}</span> : null}
              </button>
              <button type="button" className={primaryButtonClass} onClick={() => setShowCreate(true)}><AddIcon className="h-4 w-4" />สร้างโปรเจกต์</button>
            </div>
          </div>
        </section>

        <Tabs<Tab>
          active={tab}
          onChange={setTab}
          tabs={[
            { id: "all", label: "ทั้งหมด", count: projects.length },
            { id: "recommended", label: "แนะนำให้ฉัน" },
            { id: "follow", label: "กำลังติดตาม" },
            { id: "mine", label: "ของฉัน" },
          ]}
        />

        {visible.length ? (
          <div className="grid gap-5 md:grid-cols-2">
            {visible.map((project) => <ProjectCard key={project.id} project={project} onOpen={() => setSelected(project)} />)}
          </div>
        ) : <EmptyState title="ไม่พบโปรเจกต์" description={tab === "recommended" ? "เพิ่ม Skill ในโปรไฟล์เพื่อให้ระบบช่วยแนะนำทีมได้ตรงขึ้น" : "ลองเปลี่ยนคำค้นหาหรือล้างตัวกรองแล้วลองอีกครั้ง"} />}
      </>
    );
  }

  function DashboardView() {
    return (
      <>
        <PageHeader title="Dashboard" description="ภาพรวมโปรเจกต์ งานที่คุณกำลังร่วม และคำขอที่ต้องจัดการ" />
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard value={projects.filter((p) => p.owner.isCurrentUser).length} label="โปรเจกต์ที่เป็นเจ้าของ" />
          <StatCard value={projects.filter((p) => p.owner.isCurrentUser && p.status === "RECRUITING").length} label="กำลังหาคน" />
          <StatCard value={pendingApplications} label="ผู้สมัครรอตอบ" />
          <StatCard value={acceptedMemberships} label="โปรเจกต์ที่ฉันร่วม" />
        </section>
        <section className="grid gap-5 lg:grid-cols-2">
          <div className={`${cardClass} p-5`}>
            <div className="flex items-center justify-between gap-3"><h2 className="text-headline-md font-semibold">โปรเจกต์ของฉัน</h2><span className="text-label-sm text-on-surface-variant">{projects.filter((p) => p.owner.isCurrentUser).length} รายการ</span></div>
            <div className="mt-4 space-y-3">{projects.filter((p) => p.owner.isCurrentUser).slice(0, 5).map((p) => <button key={p.id} type="button" className="w-full rounded-lg border border-outline-variant p-3 text-left hover:bg-surface-container-low" onClick={() => setSelected(p)}><div className="flex items-center justify-between gap-3"><div className="font-semibold">{p.title}</div><StatusBadge tone={statusTone[p.status]} label={statusLabel[p.status]} /></div><div className="mt-1 text-label-sm text-on-surface-variant">{p.acceptedCount}/{p.size} คน · {p.applications.filter((a) => a.status === "PENDING").length} คำขอรอตอบ</div></button>)}{!projects.some((p) => p.owner.isCurrentUser) ? <EmptyState title="ยังไม่มีโปรเจกต์" description="สร้างโปรเจกต์แรกของคุณจากปุ่มด้านบน" /> : null}</div>
          </div>
          <div className={`${cardClass} p-5`}>
            <div className="flex items-center justify-between gap-3"><h2 className="text-headline-md font-semibold">งานที่ฉันกำลังร่วม</h2></div>
            <div className="mt-4 space-y-3">{projects.filter((p) => p.members.some((m) => m.isCurrentUser)).slice(0, 5).map((p) => <button key={p.id} type="button" className="w-full rounded-lg border border-outline-variant p-3 text-left hover:bg-surface-container-low" onClick={() => setSelected(p)}><div className="flex items-center justify-between gap-3"><div className="font-semibold">{p.title}</div><StatusBadge tone={statusTone[p.status]} label={statusLabel[p.status]} /></div><div className="mt-1 text-label-sm text-on-surface-variant">เจ้าของ {p.owner.coreUserId}</div></button>)}{!projects.some((p) => p.members.some((m) => m.isCurrentUser)) ? <EmptyState title="ยังไม่ได้เข้าร่วมโปรเจกต์" description="ไปที่ค้นหาโปรเจกต์เพื่อสมัครเข้าทีม" /> : null}</div>
          </div>
        </section>
      </>
    );
  }

  function MessagesView() {
    const conversation = conversations.find((item) => item.id === selectedConversationId) ?? conversations[0];
    return (
      <>
        <PageHeader title="ข้อความ" description="คุยกับเจ้าของโปรเจกต์และสมาชิกด้วย identity จาก Core Hub" />
        <section className={`${cardClass} overflow-hidden`}>
          <div className="grid min-h-[560px] lg:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="border-b border-outline-variant bg-surface-container-low p-4 lg:border-b-0 lg:border-r"><h2 className="text-headline-sm font-semibold">บทสนทนา</h2><div className="mt-3 space-y-2">{conversations.map((item) => <button key={item.id} type="button" onClick={() => setSelectedConversationId(item.id)} className={`w-full rounded-lg p-3 text-left ${conversation?.id === item.id ? "bg-primary-container text-white" : "hover:bg-surface-container"}`}><div className="font-semibold">{item.participants.filter((p) => p.coreUserId !== me?.coreUserId).map((p) => p.coreUserId).join(", ") || "บทสนทนา"}</div><div className={`mt-1 text-label-sm ${conversation?.id === item.id ? "text-white/80" : "text-on-surface-variant"}`}>{item.messages[0]?.body ?? "เริ่มสนทนา"}</div></button>)}{!conversations.length ? <p className="text-label-sm text-on-surface-variant">ยังไม่มีบทสนทนา</p> : null}</div><div className="mt-4"><label htmlFor="message-target" className="mb-1.5 block text-label-sm font-semibold">เปิดแชตด้วย core_user_id</label><div className="flex gap-2"><input id="message-target" value={messageTarget} onChange={(e) => setMessageTarget(e.target.value)} className={inputClass} placeholder="เช่น user-..." /><button type="button" disabled={!messageTarget.trim() || busy} onClick={() => void createConversation()} className={primaryButtonClass}>เปิด</button></div></div></aside>
            <div className="p-5 md:p-6">{conversation ? <ConversationPanel conversation={conversation} /> : <EmptyState title="เลือกบทสนทนา" description="เลือกจากรายการด้านซ้าย หรือเปิดบทสนทนาใหม่ด้วย Core User ID" />}</div>
          </div>
        </section>
      </>
    );
  }

  function ConversationPanel({ conversation }: { conversation: Conversation }) {
    return <div><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-container text-sm font-bold text-white">{conversation.participants.find((p) => p.coreUserId !== me?.coreUserId)?.coreUserId.slice(-2).toUpperCase() ?? "TU"}</div><div><h2 className="text-headline-md font-semibold">{conversation.participants.find((p) => p.coreUserId !== me?.coreUserId)?.coreUserId ?? "บทสนทนา"}</h2><p className="text-label-sm text-on-surface-variant">ข้อความจะผูกกับ Core User ID ไม่ใช้ชื่อเป็น key</p></div></div><div className="mt-5 h-80 space-y-3 overflow-y-auto rounded-lg bg-surface-container-low p-4">{conversation.messages.length ? conversation.messages.map((message) => <div key={message.id} className={`max-w-xl rounded-lg px-3 py-2 text-body-md ${message.senderCoreUserId === me?.coreUserId ? "ml-auto bg-primary-container text-white" : "mr-auto bg-surface-container-lowest"}`}><p>{message.body}</p><span className="mt-1 block text-caption opacity-70">{formatDate(message.createdAt)}</span></div>) : <p className="text-label-sm text-on-surface-variant">เริ่มบทสนทนา</p>}</div><div className="mt-4"><label htmlFor="message-input" className="mb-1.5 block text-label-sm font-semibold">ข้อความ</label><div className="flex gap-3"><input id="message-input" value={messageText} onChange={(e) => setMessageText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void sendMessage(conversation.id); }} className={inputClass} placeholder="พิมพ์ข้อความ..." /><button type="button" disabled={!messageText.trim() || busy} onClick={() => void sendMessage(conversation.id)} className={primaryButtonClass}>ส่ง</button></div></div></div>;
  }

  function ProfileView() {
    return (
      <>
        <PageHeader title="โปรไฟล์การทำงาน" description="จัดการข้อมูล collaboration ของคุณ โดยไม่คัดลอกตัวตนจาก Core Hub มาเป็นฐานข้อมูลของ TeamUp" />
        <form onSubmit={async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); await act("/api/v1/profile", "PATCH", { skills: splitField(form.get("skills")), githubUrl: String(form.get("githubUrl") ?? "").trim() || undefined, linkedinUrl: String(form.get("linkedinUrl") ?? "").trim() || undefined, contactText: String(form.get("contactText") ?? "").trim() || undefined, isAvailable: form.get("isAvailable") === "on" }, "บันทึกโปรไฟล์แล้ว"); }} className={`${cardClass} p-5 md:p-6`}>
          <div className="grid gap-5 md:grid-cols-2">
            <ReadOnlyField label="Core User ID" value={me?.coreUserId ?? "-"} />
            <ReadOnlyField label="Core role" value={me?.coreRole ?? "-"} />
          </div>
          <div className="mt-5"><label htmlFor="profile-skills" className="mb-1.5 block text-label-sm font-semibold">Skill tags</label><input id="profile-skills" name="skills" defaultValue={profile?.skills.join(", ") ?? ""} className={inputClass} aria-describedby="profile-skills-help" /><p id="profile-skills-help" className="mt-1.5 text-label-sm text-on-surface-variant">คั่นแต่ละ Skill ด้วย comma เช่น React, Node.js, UX</p></div>
          <div className="mt-5 grid gap-5 md:grid-cols-2"><FieldInput id="profile-github" name="githubUrl" label="GitHub" defaultValue={profile?.githubUrl ?? ""} /><FieldInput id="profile-linkedin" name="linkedinUrl" label="LinkedIn" defaultValue={profile?.linkedinUrl ?? ""} /></div>
          <div className="mt-5"><FieldInput id="profile-contact" name="contactText" label="ช่องทางติดต่อที่คุณเลือกเผยแพร่" defaultValue={profile?.contactText ?? ""} /></div>
          <label className="mt-5 flex items-center gap-3 text-label-md"><input type="checkbox" name="isAvailable" defaultChecked={profile?.isAvailable ?? true} className="h-4 w-4 accent-primary" />พร้อมรับงานและร่วมทีม</label>
          <div className="mt-6 flex justify-end"><button type="submit" disabled={busy} className={primaryButtonClass}><CheckIcon className="h-4 w-4" />บันทึกโปรไฟล์</button></div>
        </form>
        <section className={`${cardClass} p-5 md:p-6`}><h2 className="text-headline-md font-semibold">Portfolio</h2><p className="mt-1 text-body-md text-on-surface-variant">เก็บเฉพาะ imageId ของรูปที่ผ่าน Core Hub Image API</p><div className="mt-4 space-y-2">{profile?.portfolio.length ? profile.portfolio.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-outline-variant p-3"><div><p className="font-semibold">{item.imageId}</p><p className="text-label-sm text-on-surface-variant">{item.caption ?? "ไม่มีคำอธิบาย"}</p></div><button type="button" className={dangerButtonClass} onClick={() => void act(`/api/v1/profile/portfolio/${item.id}`, "DELETE", undefined, "ลบผลงานแล้ว")}>ลบ</button></div>) : <EmptyState title="ยังไม่มีผลงาน" description="เพิ่ม imageId จากระบบรูปของ Core Hub ได้ภายหลัง" />}</div><form className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_auto]" onSubmit={async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); await act("/api/v1/profile/portfolio", "POST", { imageId: String(form.get("imageId") ?? "").trim(), caption: String(form.get("caption") ?? "").trim() || undefined }, "เพิ่มผลงานแล้ว"); event.currentTarget.reset(); }}><FieldInput id="portfolio-image-id" name="imageId" label="imageId" required /><FieldInput id="portfolio-caption" name="caption" label="คำอธิบาย" /><button type="submit" disabled={busy} className={`${primaryButtonClass} self-end`}>เพิ่มผลงาน</button></form></section>
      </>
    );
  }
}

function ProjectCard({ project, onOpen }: { project: Project; onOpen: () => void }) {
  return <article className={`${cardClass} p-5`}><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-primary-container/10 px-2.5 py-1 text-label-sm text-primary-container">{kindLabel[project.kind]}</span><StatusBadge tone={statusTone[project.status]} label={statusLabel[project.status]} />{project.acceptedCount >= project.size ? <StatusBadge tone="neutral" label="เต็มแล้ว" /> : null}</div><h2 className="mt-4 text-headline-md font-semibold">{project.title}</h2><p className="mt-2 line-clamp-3 text-body-md text-on-surface-variant">{project.description}</p><div className="mt-4 flex flex-wrap gap-2">{project.skills.slice(0, 5).map((s) => <span key={s} className="rounded-lg border border-outline-variant px-2.5 py-1 text-label-sm">{s}</span>)}</div><div className="mt-5 grid gap-3 border-t border-outline-variant/50 pt-4 sm:grid-cols-[1fr_auto] sm:items-end"><div><p className="text-label-sm text-on-surface-variant">{formatLabel[project.format]} · {project.acceptedCount}/{project.size} คน</p><p className="mt-1 text-label-sm text-on-surface-variant">เจ้าของ {project.owner.coreUserId}</p></div><button type="button" onClick={onOpen} className={secondaryButtonClass}>ดูรายละเอียด</button></div></article>;
}

function ProjectModal({ project, me, busy, onClose, onEdit, onAction }: { project: Project; me: Me | null; busy: boolean; onClose: () => void; onEdit: () => void; onAction: (path: string, method?: string, body?: unknown, success?: string) => Promise<void> }) {
  const [role, setRole] = useState(project.currentApplication?.status ? "" : project.roles[0] ?? "");
  const [message, setMessage] = useState("");
  const [invitee, setInvitee] = useState("");
  const [inviteRole, setInviteRole] = useState(project.roles[0] ?? "");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<Record<string, string>>({});
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const owned = project.owner.isCurrentUser;
  const participant = project.members.some((item) => item.isCurrentUser);
  const canApply = !owned && !project.currentApplication && !project.currentInvitation && project.remainingSlots > 0 && project.status === "RECRUITING";
  const reviewable = project.status === "COMPLETED" && participant;

  return <>
  <Modal title={project.title} onClose={onClose}><div className="space-y-5">
    <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-primary-container/10 px-2.5 py-1 text-label-sm text-primary-container">{kindLabel[project.kind]}</span><StatusBadge tone={statusTone[project.status]} label={statusLabel[project.status]} /><span className="text-label-sm text-on-surface-variant">{project.acceptedCount}/{project.size} คน</span></div>
    <div><p className="text-body-md text-on-surface">{project.description}</p><p className="mt-2 text-label-sm text-on-surface-variant">{project.format ? formatLabel[project.format] : ""}{project.duration ? ` · ${project.duration}` : ""}{project.courseCode ? ` · ${project.courseCode}` : ""}</p></div>
    {owned ? <div className="rounded-lg bg-surface-container-low p-3"><label htmlFor="project-status" className="mb-1.5 block text-label-sm font-semibold">สถานะโปรเจกต์</label><select id="project-status" value={project.status} disabled={busy} onChange={(event) => void onAction(`/api/v1/projects/${project.id}/status`, "PATCH", { status: event.target.value }, "อัปเดตสถานะแล้ว")} className={inputClass}><option value="RECRUITING">กำลังหาคน</option><option value="IN_PROGRESS">กำลังพัฒนา</option><option value="COMPLETED">เสร็จสมบูรณ์</option></select></div> : null}
    <TagSection title="ตำแหน่งที่ต้องการ" items={project.roles} /><TagSection title="Skill ที่ต้องการ" items={project.skills} />

     { !owned && project.currentApplication ? <div className="rounded-lg bg-surface-container-low p-4"><p className="font-semibold">สถานะคำขอของคุณ</p><p className="mt-1 text-label-sm text-on-surface-variant">{project.currentApplication.status === "PENDING" ? "รอเจ้าของโปรเจกต์ตอบรับ" : project.currentApplication.status === "ACCEPTED" ? "ตอบรับเข้าทีมแล้ว" : "คำขอถูกปฏิเสธแล้ว"}</p></div> : null}
    {!owned && project.currentInvitation ? <div className="rounded-lg bg-primary-fixed p-4"><p className="font-semibold">คุณได้รับคำเชิญเข้าร่วมโปรเจกต์</p><p className="mt-1 text-label-sm text-on-primary-fixed-variant">ตำแหน่ง: {project.currentInvitation.role ?? "สมาชิก"}</p><div className="mt-3 flex gap-2"><button type="button" disabled={busy} className={primaryButtonClass} onClick={() => void onAction(`/api/v1/projects/${project.id}/invitations/${project.currentInvitation?.id}/accept`, "POST", undefined, "เข้าร่วมโปรเจกต์แล้ว")}>ตอบรับ</button><button type="button" disabled={busy} className={secondaryButtonClass} onClick={() => void onAction(`/api/v1/projects/${project.id}/invitations/${project.currentInvitation?.id}/decline`, "POST", undefined, "ปฏิเสธคำเชิญแล้ว")}>ปฏิเสธ</button></div></div> : null}

    {canApply ? <section className="rounded-lg border border-outline-variant p-4"><h3 className="text-headline-sm font-semibold">สมัครเข้าร่วมทีม</h3><div className="mt-3 grid gap-3"><FieldInput id="apply-role" name="role" label="ตำแหน่งที่สนใจ" value={role} onChange={setRole} /><div><label htmlFor="apply-message" className="mb-1.5 block text-label-sm font-semibold">แนะนำตัวสั้น ๆ</label><textarea id="apply-message" value={message} onChange={(e) => setMessage(e.target.value)} className={`${inputClass} min-h-24`} /></div></div><button type="button" disabled={busy} className={`${primaryButtonClass} mt-3`} onClick={() => void onAction(`/api/v1/projects/${project.id}/applications`, "POST", { role: role.trim() || undefined, message: message.trim() || undefined }, "ส่งคำขอเข้าร่วมแล้ว")}>ส่งคำขอเข้าร่วม</button></section> : null}

    <section><div className="flex items-center justify-between"><h3 className="text-headline-sm font-semibold">สมาชิก</h3><span className="text-label-sm text-on-surface-variant">{project.members.length}</span></div><div className="mt-3 space-y-2">{project.members.map((member) => <div key={member.id} className="rounded-lg border border-outline-variant p-3"><div className="flex items-center justify-between gap-3"><div><p className="font-semibold">{member.coreUserId}{member.isCurrentUser ? " · คุณ" : ""}</p><p className="text-label-sm text-on-surface-variant">{member.role || "สมาชิก"}{member.message ? ` · ${member.message}` : ""}</p></div><StatusBadge tone="success" label="เข้าร่วมแล้ว" /></div></div>)}{!project.members.length ? <EmptyState title="ยังไม่มีสมาชิก" description="ยังไม่มีผู้สมัครที่ตอบรับ" /> : null}</div></section>

    {owned ? <section className="rounded-lg border border-outline-variant p-4"><h3 className="text-headline-sm font-semibold">คำขอเข้าร่วม</h3><div className="mt-3 space-y-2">{project.applications.filter((a) => a.status === "PENDING").map((application) => <div key={application.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-container-low p-3"><div><p className="font-semibold">{application.coreUserId}</p><p className="text-label-sm text-on-surface-variant">{application.role ?? "สมาชิก"}{application.message ? ` · ${application.message}` : ""}</p></div><div className="flex gap-2"><button type="button" disabled={busy} className={primaryButtonClass} onClick={() => void onAction(`/api/v1/projects/${project.id}/applications/${application.id}/accept`, "POST", undefined, "รับสมาชิกแล้ว")}><CheckIcon className="h-4 w-4" />รับ</button><button type="button" disabled={busy} className={dangerButtonClass} onClick={() => void onAction(`/api/v1/projects/${project.id}/applications/${application.id}/reject`, "POST", undefined, "ปฏิเสธคำขอแล้ว")}>ปฏิเสธ</button></div></div>)}{!project.applications.some((a) => a.status === "PENDING") ? <p className="text-label-sm text-on-surface-variant">ไม่มีคำขอรอตอบ</p> : null}</div></section> : null}

    {owned && project.remainingSlots > 0 ? <section className="rounded-lg border border-outline-variant p-4"><h3 className="text-headline-sm font-semibold">เชิญสมาชิก</h3><p className="mt-1 text-label-sm text-on-surface-variant">ใช้ Core User ID เท่านั้น</p><div className="mt-3 grid gap-3 md:grid-cols-[1.4fr_1fr_auto]"><FieldInput id="invitee-core-id" name="invitee" label="core_user_id" value={invitee} onChange={setInvitee} /><FieldInput id="invite-role" name="invite-role" label="ตำแหน่ง" value={inviteRole} onChange={setInviteRole} /><button type="button" disabled={!invitee.trim() || busy} className={`${primaryButtonClass} self-end`} onClick={() => void onAction(`/api/v1/projects/${project.id}/invitations`, "POST", { inviteeCoreUserId: invitee.trim(), role: inviteRole.trim() || undefined }, "ส่งคำเชิญแล้ว")} >เชิญ</button></div></section> : null}

    <section className="rounded-lg border border-outline-variant p-4"><h3 className="text-headline-sm font-semibold">ถาม-ตอบ</h3><div className="mt-3 space-y-3">{project.questions.map((item) => <div key={item.id} className="rounded-lg bg-surface-container-low p-3"><p className="font-semibold">ถาม: {item.question}</p>{item.answer ? <p className="mt-2 text-body-md text-on-surface-variant">ตอบ: {item.answer}</p> : owned ? <div className="mt-2 flex gap-2"><input id={`answer-${item.id}`} value={answer[item.id] ?? ""} onChange={(e) => setAnswer({ ...answer, [item.id]: e.target.value })} className={inputClass} placeholder="พิมพ์คำตอบ" /><button type="button" disabled={busy || !answer[item.id]?.trim()} className={primaryButtonClass} onClick={() => void onAction(`/api/v1/projects/${project.id}/questions/${item.id}`, "PATCH", { answer: answer[item.id].trim() }, "ตอบคำถามแล้ว")}>ตอบ</button></div> : <p className="mt-2 text-label-sm text-on-surface-variant">รอเจ้าของตอบ</p>}</div>)}{!project.questions.length ? <p className="text-label-sm text-on-surface-variant">ยังไม่มีคำถาม</p> : null}</div>{!owned ? <div className="mt-3 flex gap-2"><input id="project-question" value={question} onChange={(e) => setQuestion(e.target.value)} className={inputClass} placeholder="ถามก่อนสมัคร..." /><button type="button" disabled={busy || !question.trim()} className={primaryButtonClass} onClick={() => void onAction(`/api/v1/projects/${project.id}/questions`, "POST", { question: question.trim() }, "ส่งคำถามแล้ว")}>ถาม</button></div> : null}</section>

    {reviewable ? <section className="rounded-lg border border-outline-variant p-4"><h3 className="text-headline-sm font-semibold">รีวิวสมาชิก</h3><div className="mt-3 flex flex-wrap items-center gap-1">{[1,2,3,4,5].map((value) => <button key={value} type="button" aria-label={`ให้ ${value} ดาว`} onClick={() => setStars(value)} className="rounded-lg p-1 hover:bg-surface-container"><StarIcon className={`h-6 w-6 ${value <= stars ? "fill-current text-amber-500" : "text-outline"}`} /></button>)}</div><label htmlFor="review-comment" className="mt-3 mb-1.5 block text-label-sm font-semibold">คอมเมนต์</label><textarea id="review-comment" value={comment} onChange={(e) => setComment(e.target.value)} className={`${inputClass} min-h-24`} placeholder="คอมเมนต์สั้น ๆ (ไม่บังคับ)" /><button type="button" disabled={!stars || busy} className={`${primaryButtonClass} mt-3`} onClick={() => { const target = owned ? project.members.find((m) => !m.isCurrentUser)?.coreUserId : project.owner.coreUserId; if (target) void onAction(`/api/v1/projects/${project.id}/reviews`, "POST", { toCoreUserId: target, stars, comment: comment.trim() || undefined }, "ส่งรีวิวแล้ว"); }}>ส่งรีวิว</button></section> : null}

    <div className="flex flex-wrap justify-end gap-3">{!owned ? <button type="button" className={secondaryButtonClass} disabled={busy} onClick={() => void onAction(`/api/v1/projects/${project.id}/follow`, "POST", undefined, project.isFollowing ? "เลิกติดตามแล้ว" : "ติดตามแล้ว")}>{project.isFollowing ? "เลิกติดตาม" : "ติดตามโปรเจกต์"}</button> : null}{owned ? <button type="button" className={secondaryButtonClass} onClick={onEdit}><EditIcon className="h-4 w-4" />แก้ไข</button> : null}{owned ? <button type="button" className={dangerButtonClass} onClick={() => setConfirmDelete(true)}><DeleteIcon className="h-4 w-4" />ลบโปรเจกต์</button> : null}<button type="button" className={secondaryButtonClass} onClick={onClose}>ปิด</button></div>
  </div></Modal>
  {confirmDelete ? <ConfirmDeleteModal title="ลบโปรเจกต์" message={<span>คุณกำลังจะลบโปรเจกต์ <strong className="text-on-surface">{project.title}</strong> การลบนี้ไม่สามารถย้อนกลับได้</span>} onClose={() => setConfirmDelete(false)} onConfirm={() => { setConfirmDelete(false); void onAction(`/api/v1/projects/${project.id}`, "DELETE", undefined, "ลบโปรเจกต์แล้ว").then(onClose); }} /> : null}
  </>;
}

function CreateModal({ onClose, onSubmit, busy }: { onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  return <Modal title="สร้างโปรเจกต์" onClose={onClose}><ProjectForm onClose={onClose} onSubmit={onSubmit} busy={busy} submitLabel="สร้างโปรเจกต์" /></Modal>;
}

function EditProjectModal({ project, onClose, onSubmit, busy }: { project: Project; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  return <Modal title="แก้ไขโปรเจกต์" onClose={onClose}><ProjectForm project={project} onClose={onClose} onSubmit={onSubmit} busy={busy} submitLabel="บันทึกการแก้ไข" /></Modal>;
}

function ProjectForm({ project, onClose, onSubmit, busy, submitLabel }: { project?: Project; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; busy: boolean; submitLabel: string }) {
  return <form onSubmit={onSubmit} className="space-y-4"><FieldInput id="project-title" name="title" label="ชื่อโปรเจกต์" required defaultValue={project?.title ?? ""} /><div className="grid gap-4 md:grid-cols-2"><div><label htmlFor="project-kind" className="mb-1.5 block text-label-sm font-semibold">ประเภท <span aria-hidden>*</span></label><select id="project-kind" name="kind" required aria-required="true" defaultValue={project?.kind ?? "COURSE"} className={inputClass}><option value="COURSE">งานรายวิชา</option><option value="SENIOR_PROJECT">โปรเจกต์จบ</option><option value="PERSONAL_COMPETITION">ส่วนตัว / แข่งขัน</option></select></div><FieldInput id="project-course" name="courseCode" label="รหัสวิชา" defaultValue={project?.courseCode ?? ""} /></div><div className="grid gap-4 md:grid-cols-3"><FieldInput id="project-size" name="size" label="จำนวนสมาชิก" type="number" min={1} max={100} required defaultValue={project?.size ?? 4} /><FieldInput id="project-duration" name="duration" label="ระยะเวลา" defaultValue={project?.duration ?? ""} /><div><label htmlFor="project-format" className="mb-1.5 block text-label-sm font-semibold">รูปแบบ</label><select id="project-format" name="format" defaultValue={project?.format ?? "HYBRID"} className={inputClass}><option value="ONLINE">ออนไลน์</option><option value="ONSITE">ออนไซต์</option><option value="HYBRID">ผสม</option></select></div></div><div><label htmlFor="project-description" className="mb-1.5 block text-label-sm font-semibold">รายละเอียด <span aria-hidden>*</span></label><textarea id="project-description" name="description" required aria-required="true" defaultValue={project?.description ?? ""} className={`${inputClass} min-h-28`} /></div><FieldInput id="project-roles" name="roles" label="ตำแหน่งที่ต้องการ" defaultValue={project?.roles.join(", ") ?? ""} placeholder="Frontend, Backend" /><FieldInput id="project-skills" name="skills" label="Skill ที่ต้องการ" defaultValue={project?.skills.join(", ") ?? ""} placeholder="React, Node.js" /><FieldInput id="project-contact" name="contactText" label="ช่องทางติดต่อ" defaultValue={project?.contactText ?? ""} /><div className="flex justify-end gap-3"><button type="button" onClick={onClose} className={secondaryButtonClass}>ยกเลิก</button><button type="submit" disabled={busy} className={primaryButtonClass}>{submitLabel}</button></div></form>;
}

function NotificationsModal({ items, onClose, onRead }: { items: Notification[]; onClose: () => void; onRead: (id: string) => void }) {
  return <Modal title="การแจ้งเตือน" onClose={onClose}><div className="space-y-2">{items.length ? items.map((item) => <button key={item.id} type="button" onClick={() => { if (!item.isRead) onRead(item.id); }} className={`w-full rounded-lg border p-3 text-left ${item.isRead ? "border-outline-variant bg-surface-container-low" : "border-primary-container bg-primary-fixed"}`}><p className="font-semibold">{item.message}</p><p className="mt-1 text-label-sm text-on-surface-variant">{formatDate(item.createdAt)}</p></button>) : <EmptyState title="ไม่มีการแจ้งเตือน" description="เมื่อมีคำขอหรือข้อความใหม่จะแสดงที่นี่" />}</div></Modal>;
}

function FilterSelect({ id, label, value, onChange, options, labels }: { id: string; label: string; value: string; onChange: (value: string) => void; options: string[]; labels: Record<string, string> }) {
  return <div><label htmlFor={id} className="mb-1.5 block text-label-sm font-semibold">{label}</label><select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}><option value="">ทั้งหมด</option>{options.map((option) => <option key={option} value={option}>{labels[option]}</option>)}</select></div>;
}

function FieldInput({ id, name, label, value, onChange, defaultValue, placeholder, required = false, type = "text", min, max }: { id: string; name: string; label: string; value?: string; onChange?: (value: string) => void; defaultValue?: string | number; placeholder?: string; required?: boolean; type?: string; min?: number; max?: number }) {
  return <div><label htmlFor={id} className="mb-1.5 block text-label-sm font-semibold">{label}{required ? " *" : ""}</label><input id={id} name={name} type={type} min={min} max={max} value={value} defaultValue={defaultValue} onChange={onChange ? (event) => onChange(event.target.value) : undefined} placeholder={placeholder} required={required} aria-required={required ? "true" : undefined} className={inputClass} /></div>;
}

function ReadOnlyField({ label, value }: { label: string; value: string }) { return <div><span className="mb-1.5 block text-label-sm font-semibold">{label}</span><div className="rounded-lg border border-outline-variant bg-surface-container px-3 py-2.5 text-body-md text-on-surface-variant">{value}</div></div>; }
function TagSection({ title, items }: { title: string; items: string[] }) { return <div><p className="mb-2 text-label-sm font-semibold">{title}</p><div className="flex flex-wrap gap-2">{items.map((item) => <span key={item} className="rounded-lg border border-outline-variant px-2.5 py-1 text-label-sm">{item}</span>)}</div></div>; }
function StatCard({ value, label }: { value: number; label: string }) { return <div className={`${cardClass} p-5`}><div className="text-display-sm font-semibold text-primary-container">{value}</div><div className="mt-1 text-label-md text-on-surface-variant">{label}</div></div>; }
function EmptyState({ title, description }: { title: string; description: string }) { return <div className="rounded-lg border border-dashed border-outline-variant p-8 text-center"><p className="font-semibold">{title}</p><p className="mt-1 text-body-md text-on-surface-variant">{description}</p></div>; }
function LoadingState() { return <div className="space-y-5" role="status" aria-live="polite"><PageHeader title="CS TeamUp" description="กำลังโหลดข้อมูลโปรเจกต์ของคุณ..." /><div className="grid gap-5 md:grid-cols-2">{[1,2,3,4].map((item) => <div key={item} className={`${cardClass} h-52 animate-pulse bg-surface-container`} />)}</div></div>; }
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) { return <div className="rounded-xl border border-error bg-error-container p-6" role="alert"><h1 className="text-headline-md font-semibold text-on-error-container">เกิดข้อผิดพลาด</h1><p className="mt-2 text-body-md text-on-error-container">{message}</p><button type="button" onClick={onRetry} className={`${secondaryButtonClass} mt-4`}>ลองอีกครั้ง</button></div>; }
function splitField(value: FormDataEntryValue | null) { return String(value ?? "").split(",").map((x) => x.trim()).filter(Boolean); }

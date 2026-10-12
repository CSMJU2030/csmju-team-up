"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader, StatusBadge, cardClass, primaryButtonClass, secondaryButtonClass } from "@/csmju";
import { api, ApiException, formatDate } from "@/components/api";

type Reward = {
  id: string;
  name: string;
  description: string;
  category: string;
  pointCost: number;
  remainingQuantity: number | null;
};

type Redemption = {
  id: string;
  status: "REQUESTED" | "APPROVED" | "REJECTED" | "FULFILLED" | "CANCELLED";
  pointCost: number;
  requestNote: string | null;
  createdAt: string;
  reward: Pick<Reward, "name" | "category">;
};

type RewardsData = { redemptions: Redemption[]; points: number };

const labels: Record<Redemption["status"], { label: string; tone: "success" | "info" | "neutral" | "warning" }> = {
  REQUESTED: { label: "รออนุมัติ", tone: "info" },
  APPROVED: { label: "อนุมัติแล้ว / รอรับ", tone: "success" },
  REJECTED: { label: "ไม่อนุมัติ", tone: "warning" },
  FULFILLED: { label: "รับรางวัลแล้ว", tone: "success" },
  CANCELLED: { label: "ยกเลิก", tone: "neutral" },
};

export default function RewardCenter() {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [data, setData] = useState<RewardsData>({ redemptions: [], points: 0 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const [catalog, redemptions] = await Promise.all([
        api<Reward[]>("/api/v1/rewards"),
        api<RewardsData>("/api/v1/rewards/redemptions/me"),
      ]);
      setRewards(catalog);
      setData(redemptions);
      setError("");
    } catch (cause) {
      setError(cause instanceof ApiException ? cause.message : "โหลดข้อมูลรางวัลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api<Reward[]>("/api/v1/rewards"),
      api<RewardsData>("/api/v1/rewards/redemptions/me"),
    ]).then(([catalog, redemptions]) => {
      if (!cancelled) { setRewards(catalog); setData(redemptions); setError(""); }
    }).catch((cause) => {
      if (!cancelled) setError(cause instanceof ApiException ? cause.message : "โหลดข้อมูลรางวัลไม่สำเร็จ");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  async function redeem(reward: Reward) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(`/api/v1/rewards/${reward.id}/redemptions`, { method: "POST", body: JSON.stringify({}) });
      setNotice("ส่งคำขอแลกรางวัลแล้ว แต้มถูกหักไว้ชั่วคราวและคืนให้อัตโนมัติหากคุณยกเลิกรายการ");
      await load();
    } catch (cause) {
      setError(cause instanceof ApiException ? cause.message : "ส่งคำขอแลกรางวัลไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function cancel(redemptionId: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(`/api/v1/rewards/redemptions/${redemptionId}`, { method: "DELETE" });
      setNotice("ยกเลิกรายการและคืนแต้มแล้ว");
      await load();
    } catch (cause) {
      setError(cause instanceof ApiException ? cause.message : "ยกเลิกรายการไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return <div className="space-y-5">
    <PageHeader title="Reward Catalog" description="แลกรางวัลด้วยแต้มผลงานที่ได้รับการตรวจยืนยันแล้ว" />
    <section className={`${cardClass} p-5`}>
      <p className="text-label-sm text-on-surface-variant">แต้มคงเหลือ</p>
      <strong className="mt-1 block text-headline-lg text-primary-container">{data.points} แต้ม</strong>
    </section>
    {notice ? <p className="rounded-lg border border-outline-variant bg-surface-container-low p-3 text-label-md" role="status">{notice}</p> : null}
    {error ? <p className="rounded-lg border border-error/40 bg-error-container p-3 text-label-md" role="alert">{error}</p> : null}
    <section className="space-y-3">
      <h2 className="text-headline-md font-semibold">รางวัลที่เปิดแลก</h2>
      {loading ? <div className={`${cardClass} p-5`} role="status">กำลังโหลดรางวัล…</div> : rewards.length ? <div className="grid gap-3 sm:grid-cols-2">
        {rewards.map((reward) => <article key={reward.id} className={`${cardClass} flex flex-col gap-3 p-5`}>
          <div><p className="text-label-sm text-on-surface-variant">{reward.category}</p><h3 className="mt-1 text-headline-sm font-semibold">{reward.name}</h3></div>
          <p className="flex-1 whitespace-pre-wrap text-body-md text-on-surface-variant">{reward.description}</p>
          <p className="text-label-sm">{reward.pointCost} แต้ม · {reward.remainingQuantity === null ? "ไม่จำกัดจำนวน" : `เหลือ ${reward.remainingQuantity} ชิ้น`}</p>
          <button type="button" className={primaryButtonClass} disabled={busy || data.points < reward.pointCost} onClick={() => void redeem(reward)}>
            {data.points < reward.pointCost ? "แต้มไม่เพียงพอ" : "ขอแลกรางวัล"}
          </button>
        </article>)}
      </div> : <div className={`${cardClass} p-5 text-body-md text-on-surface-variant`}>
        ขณะนี้ยังไม่มีรางวัลที่เปิดแลก ตัวอย่างรายการถูกเก็บเป็นฉบับร่างจนกว่าสาขาจะกำหนดผู้รับผิดชอบอนุมัติ
      </div>}
    </section>
    <section className="space-y-3">
      <h2 className="text-headline-md font-semibold">ประวัติการแลก</h2>
      {data.redemptions.length ? data.redemptions.map((redemption) => <article key={redemption.id} className={`${cardClass} flex flex-wrap items-center justify-between gap-3 p-4`}>
        <div><h3 className="font-semibold">{redemption.reward.name}</h3><p className="mt-1 text-label-sm text-on-surface-variant">{redemption.pointCost} แต้ม · {formatDate(redemption.createdAt)}{redemption.requestNote ? ` · ${redemption.requestNote}` : ""}</p></div>
        <div className="flex items-center gap-2"><StatusBadge tone={labels[redemption.status].tone} label={labels[redemption.status].label} />{redemption.status === "REQUESTED" ? <button type="button" className={secondaryButtonClass} disabled={busy} onClick={() => void cancel(redemption.id)}>ยกเลิกและคืนแต้ม</button> : null}</div>
      </article>) : <div className={`${cardClass} p-5 text-body-md text-on-surface-variant`}>ยังไม่มีประวัติการแลกรางวัล</div>}
    </section>
    <p className="text-label-sm text-on-surface-variant">คำขอจะแสดงสถานะรออนุมัติจนกว่าสาขาจะกำหนดผู้รับผิดชอบการอนุมัติและจัดส่งรางวัล</p>
  </div>;
}

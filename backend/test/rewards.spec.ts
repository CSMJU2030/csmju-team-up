import { ConflictException } from "@nestjs/common";
import { jest } from "@jest/globals";
import { RewardsService } from "../src/rewards/rewards.service.js";
import type { PrismaService } from "../src/common/prisma.service.js";

const user = { coreUserId: "core-user-1" } as Parameters<RewardsService["redeem"]>[0];
const reward = {
  id: "reward-1",
  name: "Reward",
  description: "Test",
  category: "TEST",
  pointCost: 40,
  remainingQuantity: 2,
  status: "ACTIVE",
};

function serviceWithBalance(points: number) {
  const tx = {
    collaborationProfile: { upsert: jest.fn().mockResolvedValue({ id: "profile-1" }) },
    $queryRaw: jest.fn().mockResolvedValue([]),
    rewardCatalog: {
      findUnique: jest.fn().mockResolvedValue(reward),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn(),
    },
    contributionPointTransaction: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { points } }),
      create: jest.fn().mockResolvedValue({ id: "ledger-1" }),
    },
    rewardRedemption: {
      create: jest.fn().mockResolvedValue({ id: "redemption-1", reward }),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const prisma = {
    $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
  } as unknown as PrismaService;
  return { service: new RewardsService(prisma), prisma, tx };
}

describe("reward redemption", () => {
  it("reserves stock and points in one serializable transaction", async () => {
    const { service, prisma, tx } = serviceWithBalance(100);

    await service.redeem(user, reward.id, { requestNote: "For mentoring" });

    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
    expect(tx.rewardCatalog.updateMany).toHaveBeenCalledWith({
      where: { id: reward.id, status: "ACTIVE", remainingQuantity: { gt: 0 } },
      data: { remainingQuantity: { decrement: 1 } },
    });
    expect(tx.contributionPointTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        coreUserId: user.coreUserId,
        points: -reward.pointCost,
        transactionType: "REDEMPTION",
        eventKey: "reward-redemption:redemption-1",
      }),
    });
  });

  it("does not reserve stock or create a redemption when the balance is too low", async () => {
    const { service, tx } = serviceWithBalance(10);

    await expect(service.redeem(user, reward.id, {})).rejects.toBeInstanceOf(ConflictException);
    expect(tx.rewardCatalog.updateMany).not.toHaveBeenCalled();
    expect(tx.rewardRedemption.create).not.toHaveBeenCalled();
    expect(tx.contributionPointTransaction.create).not.toHaveBeenCalled();
  });
});

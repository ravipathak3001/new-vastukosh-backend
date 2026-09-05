import mongoose, { type FilterQuery } from "mongoose";
import { badInput, notFound } from "../../shared/errors.js";
import { searchRegex } from "../../graphql/admin-common.js";
import { ROLES, UserModel, type Role, type User, type UserDoc } from "../auth/auth.model.js";
import { OrderModel } from "../order/order.model.js";
import { ConsultationBookingModel } from "../consultation/consultation.model.js";
import { ContactSubmissionModel, NewsletterSubscriberModel } from "../marketing/marketing.model.js";

// ─── Admin: users ──────────────────────────────────────────────────────────

export type AdminUserFilter = { search?: string | null; role?: Role | null };

export async function listUsersForAdmin(
  filter: AdminUserFilter,
  skip: number,
  limit: number,
): Promise<{ items: UserDoc[]; total: number }> {
  const q: FilterQuery<User> = {};
  if (filter.role) q.roles = filter.role;
  if (filter.search?.trim()) {
    const rx = searchRegex(filter.search);
    q.$or = [{ name: rx }, { email: rx }];
  }
  const [items, total] = await Promise.all([
    UserModel.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit),
    UserModel.countDocuments(q),
  ]);
  return { items, total };
}

export async function getUserForAdmin(id: string): Promise<UserDoc> {
  const doc = await UserModel.findById(id);
  if (!doc) throw notFound("User");
  return doc;
}

export type UserStats = { orderCount: number; totalSpent: number; bookingCount: number };

/** Orders that never became real revenue. */
const NON_REVENUE_STATUSES = ["pending_payment", "cancelled"];

export async function getUserStats(userId: string): Promise<UserStats> {
  const objectId = new mongoose.Types.ObjectId(userId);
  const [orderAgg, bookingCount] = await Promise.all([
    OrderModel.aggregate<{ _id: null; count: number; total: number }>([
      { $match: { userId: objectId, status: { $nin: NON_REVENUE_STATUSES } } },
      { $group: { _id: null, count: { $sum: 1 }, total: { $sum: "$total" } } },
    ]),
    ConsultationBookingModel.countDocuments({ userId }),
  ]);
  const agg = orderAgg[0];
  return {
    orderCount: agg?.count ?? 0,
    totalSpent: agg?.total ?? 0,
    bookingCount,
  };
}

/**
 * Change a user's roles. Refuses to leave the portal with zero admins, and
 * refuses to let an admin strip their own access (they'd be locked out with
 * no one able to undo it from the panel).
 */
export async function setUserRoles(
  actingUserId: string,
  targetUserId: string,
  roles: Role[],
): Promise<UserDoc> {
  const losingAdmin = !roles.includes("admin");

  if (losingAdmin && targetUserId === actingUserId) {
    throw badInput("You can't remove your own admin access");
  }
  if (losingAdmin) {
    const target = await UserModel.findById(targetUserId);
    if (!target) throw notFound("User");
    if (target.roles.includes("admin")) {
      const otherAdmins = await UserModel.countDocuments({
        _id: { $ne: targetUserId },
        roles: "admin",
      });
      if (otherAdmins === 0) {
        throw badInput("Can't remove the last remaining admin");
      }
    }
  }

  const doc = await UserModel.findByIdAndUpdate(
    targetUserId,
    { $set: { roles } },
    { new: true },
  );
  if (!doc) throw notFound("User");
  return doc;
}

export { ROLES };

// ─── Admin: dashboard ───────────────────────────────────────────────────────

export type DashboardStats = {
  revenueTotal: number;
  revenue30d: number;
  ordersTotal: number;
  ordersByStatus: { status: string; count: number }[];
  bookingsPending: number;
  contactSubmissionsNew: number;
  newsletterCount: number;
};

export async function getDashboardStats(): Promise<DashboardStats> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [revenueAgg, revenue30dAgg, ordersByStatusAgg, ordersTotal, bookingsPending, contactNew, newsletterCount] =
    await Promise.all([
      OrderModel.aggregate<{ _id: null; total: number }>([
        { $match: { status: { $nin: NON_REVENUE_STATUSES } } },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
      OrderModel.aggregate<{ _id: null; total: number }>([
        {
          $match: {
            status: { $nin: NON_REVENUE_STATUSES },
            createdAt: { $gte: thirtyDaysAgo },
          },
        },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
      OrderModel.aggregate<{ _id: string; count: number }>([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      OrderModel.countDocuments({}),
      ConsultationBookingModel.countDocuments({ status: "requested" }),
      ContactSubmissionModel.countDocuments({ status: "new" }),
      NewsletterSubscriberModel.countDocuments({ status: "subscribed" }),
    ]);

  return {
    revenueTotal: revenueAgg[0]?.total ?? 0,
    revenue30d: revenue30dAgg[0]?.total ?? 0,
    ordersTotal,
    ordersByStatus: ordersByStatusAgg.map((r) => ({ status: r._id, count: r.count })),
    bookingsPending,
    contactSubmissionsNew: contactNew,
    newsletterCount,
  };
}

# Security Specification — Electricity Bill Calculator

## 1. Data Invariants

1. **Identity Integrity**: Every `Profile` document ID must equal `request.auth.uid`, and `Workspace.created_by` and `Bill.created_by` must equal `request.auth.uid` on creation.
2. **Workspace Membership Gate**: A user can only read or write `meters`, `bills`, and `bill_items` inside `/workspaces/{workspaceId}` if `/workspaces/{workspaceId}/members/{request.auth.uid}` exists.
3. **Owner-Only Destructive Actions**: Only a member whose role is `'owner'` (or the workspace creator) can delete a workspace or remove other members from `/workspaces/{workspaceId}/members/{memberId}`.
4. **Strict Schema & Volumetric Bounds**: All strings and IDs are bounded (`id.size() <= 128`, `name.size() <= 120`, `invite_code.size() <= 32`) and validated via `hasAll` / `hasOnly` to block shadow fields.
5. **Non-Negative Numeric Constraints**: `rate_per_unit >= 0`, `initial_reading >= 0`, `previous_reading >= 0`, `current_reading >= previous_reading`, `units >= 0`, `amount >= 0`.

## 2. The "Dirty Dozen" Payloads

1. **Shadow Field Injection on Workspace**: `{ id: "ws1", name: "Home", invite_code: "ABCD1234", created_by: "u1", created_at: "2026-10-01T00:00:00Z", isAdmin: true }` -> Rejected by `hasOnly`.
2. **Identity Spoofing on Workspace Creation**: `{ id: "ws1", name: "Home", invite_code: "ABCD1234", created_by: "victim_uid", created_at: "2026-10-01T00:00:00Z" }` -> Rejected because `created_by != request.auth.uid`.
3. **ID Poisoning on Meter Creation**: Document ID with 300 characters or invalid characters (`../etc/passwd`) -> Rejected by `isValidId()`.
4. **Negative Billing Rate Update**: Updating `rate_per_unit` to `-5` -> Rejected by `isValidWorkspace()`.
5. **Non-Member Meter Read/Write**: Authenticated user not in `/workspaces/{workspaceId}/members/{uid}` attempting to read/create a meter -> Rejected by `isWorkspaceMember(workspaceId)`.
6. **Member Deleting Another Member**: Regular `member` trying to delete another user's document in `/workspaces/{workspaceId}/members/{otherUid}` -> Rejected by `isWorkspaceOwner(workspaceId)`.
7. **Member Deleting Workspace**: Regular `member` attempting to delete `/workspaces/{workspaceId}` -> Rejected by `isWorkspaceOwner(workspaceId)`.
8. **Current Reading Lower Than Previous on Bill Item**: `{ previous_reading: 500, current_reading: 450, units: -50, amount: -400 }` -> Rejected by `isValidBillItem()`.
9. **Immutable Creator Tampering on Workspace Update**: Changing `created_by` or `created_at` during workspace update -> Rejected by `affectedKeys().hasOnly(['name', 'rate_per_unit', 'invite_code'])` and immutability guard.
10. **Oversized String Denial-of-Wallet**: Sending a 50KB `name` string in `Meter` -> Rejected by `data.name.size() <= 120`.
11. **Unverified Email Write**: Attempting write when `request.auth.token.email_verified == false` -> Rejected by `isVerifiedUser()`.
12. **Orphaned Subcollection Write**: Attempting to create a bill in a non-existent workspace -> Rejected by `isWorkspaceMember(workspaceId)`.

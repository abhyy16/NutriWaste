# Nutriwaste Security Specification

## Data Invariants
1.  Only authenticated users can list/read/write data.
2.  Only users with the `admin` role can modify master data (menus, wards).
3.  Transactions must include the `staffId` of the current user.
4.  Weights (waste and consumption) must be non-negative.
5.  Comstock scale must be between 0 and 6.

## The Dirty Dozen Payloads
1.  **Identity Spoofing**: Attempt to create a transaction with a different `staffId` than the current user's UID.
2.  **Privilege Escalation**: Attempt to create a user document with `role: "admin"` as a non-authenticated or guest user.
3.  **State Shortcutting**: Attempt to update a transaction's `wasteWeight` without updating `timestamp`.
4.  **Resource Poisoning**: Attempt to use an extremely long string for `patientName`.
5.  **Master Data Tampering**: A user with `role: "nutritionist"` attempting to delete a menu.
6.  **Orphaned Transactions**: Creating a transaction with a non-existent `wardId`.
7.  **Negative Weight**: Creating a transaction with `wasteWeight: -10`.
8.  **Invalid Scale**: Creating a transaction with `comstockScale: 7`.
9.  **Unauthorized List**: Attempting to list all users as a guest.
10. **Shadow Field**: Adding `isVerified: true` to a Menu document.
11. **Bypassing App Logic**: Explicitly setting `consumptionWeight` to a value that doesn't match the menu's standard weight minus waste weight (though rules might limitedly check this if we don't have the menu weight in the transaction).
12. **Timestamp Forgery**: Providing a client-side timestamp for `timestamp` during creation.

## Rules Draft
(Waiting for Phase 4)

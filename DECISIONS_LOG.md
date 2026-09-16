# Business Decisions Log

This document records all domain, financial, and operational decisions taken during development for review by the business owner / lead.

| Date | Topic | Decision | Operational Rationale | Impact / Cost if Changed |
| :--- | :--- | :--- | :--- | :--- |
| 2026-09-16 | Stock Unit Storage | Store strictly in base units (Bottle, Packet, Kg, Liter); Cartons are multiplier-only. | Prevents manual break-bulk bookkeeping errors when transferring between Godown and Dokan. | Inventory balances remain unified and cannot drift. |
| 2026-09-16 | Stock Deficit Prompt | When Dokan stock < requested quantity, prompt cashier to fulfill remainder from Godown on same bill. | Eliminates manual gate pass paperwork and prevents lost sales during rush hours. | Single invoice records two atomic stock decrements. |
| 2026-09-16 | Negative Stock Sales | Allow negative stock when enabled in settings, styled with red alert badge. | Allows ringing up newly arrived shipments before supplier challan is typed into system. | Avoids halting shop sales; balance auto-resolves upon challan entry. |
| 2026-09-16 | Dispatch Strategy | Default to FEFO (First Expired, First Out) with 1-click cashier manual lot override. | Prevents expired agrochemical waste while giving cashier physical choice over batch in hand. | Protects store from expired chemical inventory loss. |
| 2026-09-16 | Cashier Role & Cost Hiding | 4-digit Master PIN toggles Admin Mode vs. Cashier Mode. | Prevents counter salesboys from viewing purchase cost (কেনা দাম) and daily gross profits. | Enforces business privacy and prevents price leaking. |
| 2026-09-16 | Price Overrides & Bargaining | Allow line-item price discount/override in cart while showing purchase cost to seller. | Matches physical bargaining reality in rural Bangladesh agro-markets. | Enables cashier to close deals without corrupting master product catalog. |
| 2026-09-16 | Direct Returns | Support sales returns without requiring original paper receipt lookup. | Farmers frequently lose paper receipts over 15-30 day chemical application periods. | Unopened goods restocked to Dokan/Godown; damaged goods routed to quarantine. |
| 2026-09-16 | Round-Off Adjustment | 1-click round-off field zeroes small change (e.g. ৳3, ৳7). | Prevents customer credit ledger from accumulating trivial petty debts. | Cleaner accounts receivable accounting. |
| 2026-09-16 | Money Receipt (MR No) | Generate formal Money Receipt voucher number on cash due repayments. | Farmers demand physical signed proof of debt clearance. | Protects store and customer from debt disputes. |
| 2026-09-16 | Wholesale Profile Data | Capture Business Name, Proprietor Name, Father's Name, Phone, WhatsApp, Village, MFS/Bank info, and Credit Limit. | Rural union disambiguation, sending WhatsApp digital bills, and enforcing credit ceilings. | Mitigates default risk on large seasonal chemical credit. |
| 2026-09-17 | Java 21 Pinning for Gradle | Pin org.gradle.java.home to Java 21 LTS in gradle.properties. | Ensures build reproducibility across developer machines and CI where system JDK may default to Java 25. | Prevents Gradle 8 daemon crashes on unsupported JVM versions. |

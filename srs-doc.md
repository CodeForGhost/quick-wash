# Software Requirements Specification (SRS)

## Puttalam Laundry Pickup & Management System

**Version:** 1.0
**Document Type:** Software Requirements Specification
**Project:** Puttalam Laundry Management & Pickup Platform
**Target:** MVP
**Location:** Puttalam, Sri Lanka

---

# 1. Introduction

## 1.1 Purpose

The Puttalam Laundry Pickup & Management System is a web/mobile-friendly platform that allows customers to request laundry pickup from their homes, enables pickup agents to collect multiple customers' laundry in a single route, and allows laundry shops to manage and update the processing status of each laundry order.

The system aims to simplify the laundry process by connecting:

* Customers
* Pickup/delivery agents
* Laundry shops
* System administrators

The primary goal of the MVP is to validate whether **batched laundry pickup and delivery** can work efficiently within the Puttalam area.

---

# 2. Problem Statement

Customers currently need to physically take their clothes to laundry shops and later return to collect them.

This creates several problems:

* Customers have to spend time travelling.
* Customers may not know the status of their laundry.
* Laundry shops have limited customer communication.
* Pickup and delivery is not organized.
* Individual pickup trips can become expensive.
* There is no centralized system for managing orders.

The proposed system solves this by allowing customers to request pickup and enabling one pickup agent to collect multiple orders in a specific area before delivering them to the laundry shop.

---

# 3. Product Vision

> **Make laundry pickup and delivery convenient for people in Puttalam through a shared local pickup network.**

The system should eventually allow:

```text
Customer
   ↓
Request Pickup
   ↓
Pickup Agent
   ↓
Collect Multiple Orders
   ↓
Laundry Shop
   ↓
Process Laundry
   ↓
Pickup Agent
   ↓
Customer
```

---

# 4. Goals and Objectives

## 4.1 Primary Goals

The MVP should:

1. Allow customers to request laundry pickup.
2. Allow administrators to assign pickup agents.
3. Allow agents to view assigned pickups.
4. Allow agents to mark laundry as collected.
5. Allow laundry shops to receive orders.
6. Allow shops to update laundry status.
7. Allow customers to track their laundry status.
8. Allow the system to maintain order history.
9. Support batching multiple pickups into a route.
10. Provide basic administrative management.

---

# 5. Scope

## 5.1 In Scope

The MVP will include:

* Customer registration/login
* Customer profile
* Laundry pickup request
* Address management
* Pickup date/time
* Laundry bag/item count
* Order creation
* Order tracking
* Pickup agent management
* Pickup assignment
* Pickup status updates
* Laundry shop dashboard
* Laundry processing status
* Price management
* QR/order identification
* Notifications
* Admin dashboard
* Order history
* Status history

---

## 5.2 Out of Scope

The following features will NOT be included in the initial MVP:

* AI-based laundry classification
* Automatic route optimization
* Real-time GPS tracking
* Online payment gateway
* Subscription system
* Loyalty points
* Multiple cities
* Advanced accounting
* Inventory management
* Native Android application
* Native iOS application
* Automated pricing engine
* Marketplace with hundreds of laundry shops

These can be introduced after validating the business model.

---

# 6. User Roles

The system will have four primary roles.

## 6.1 Customer

Customers can:

* Register
* Login
* Manage profile
* Manage addresses
* Request laundry pickup
* View current orders
* Track laundry status
* View previous orders
* View price
* Receive notifications

---

## 6.2 Pickup Agent

Pickup agents are responsible for collecting and delivering laundry.

They can:

* Login
* View assigned pickups
* View customer information
* View pickup address
* Contact customer
* Mark laundry as picked up
* Record bag count
* Deliver laundry to shop
* View assigned deliveries
* Mark laundry as delivered

---

## 6.3 Laundry Shop Staff

Laundry shop staff manage the laundry processing.

They can:

* Login
* View incoming laundry
* Scan/view order
* Confirm received laundry
* Update processing status
* Set/confirm price
* Mark laundry as ready
* Mark laundry for delivery
* View order history

---

## 6.4 System Administrator

Administrators manage the complete system.

They can:

* Manage customers
* Manage agents
* Manage laundry shops
* Manage orders
* Assign pickup agents
* Assign delivery agents
* View reports
* Manage system settings
* View system activity

---

# 7. System Workflow

## 7.1 Customer Workflow

```text
Customer Login
      ↓
Create Pickup Request
      ↓
Select Address
      ↓
Select Pickup Date/Time
      ↓
Enter Bag/Item Information
      ↓
Submit Request
      ↓
Order Created
      ↓
Agent Assigned
      ↓
Agent Collects Laundry
      ↓
Laundry Shop Receives Laundry
      ↓
Laundry Processing
      ↓
Laundry Ready
      ↓
Agent Collects From Shop
      ↓
Customer Receives Laundry
      ↓
Order Completed
```

---

# 8. Functional Requirements

# FR-001 Customer Registration

The system shall allow a customer to create an account.

### Required fields:

* Full name
* Mobile number
* Password or OTP authentication

### Optional fields:

* Email
* Default address

---

# FR-002 Customer Login

The system shall allow customers to authenticate using their registered phone number and authentication method.

---

# FR-003 Customer Profile

Customers shall be able to:

* View profile
* Edit name
* Edit phone number where permitted
* Manage addresses

---

# FR-004 Address Management

Customers shall be able to save multiple addresses.

Each address should contain:

* Address name
* Address details
* Area
* Landmark
* Contact number
* Optional map coordinates

Example:

```text
Home

No. 25,
Main Street,
Puttalam

Landmark:
Near XYZ School
```

---

# FR-005 Create Laundry Request

Customers shall be able to create a laundry pickup request.

Required information:

* Pickup address
* Pickup date
* Preferred time slot
* Number of bags
* Approximate number of items

Optional:

* Notes
* Special instructions

Example:

```text
Pickup Date:
03 September 2026

Time:
9:00 AM - 11:00 AM

Bags:
2

Approximate Items:
15

Notes:
Please handle white clothes separately.
```

---

# FR-006 Order Creation

When a customer submits a valid laundry request, the system shall generate a unique laundry order.

Example:

```text
Order Number:
PU-2026-0001
```

The order shall initially have:

```text
Status = PENDING
```

---

# FR-007 Pickup Assignment

An administrator shall be able to assign a pickup agent to an order.

After assignment:

```text
PENDING
   ↓
PICKUP_ASSIGNED
```

The customer should be notified.

---

# FR-008 Agent Pickup Dashboard

The pickup agent shall have a dashboard showing:

* Today's pickups
* Upcoming pickups
* Customer name
* Phone number
* Address
* Number of bags
* Pickup time
* Order status

Example:

```text
Today's Pickups

09:00 AM
Ahmed
2 Bags
Puttalam Town

[View]

10:00 AM
Fathima
1 Bag
Puttalam Town

[View]
```

---

# FR-009 Pickup Details

The agent shall be able to open an individual pickup.

The page should display:

```text
Order:
PU-2026-0001

Customer:
Ahmed

Phone:
XXXXXXXXX

Address:
Puttalam Town

Bags:
2

Notes:
Handle carefully

[Call Customer]

[Mark Picked Up]
```

---

# FR-010 Mark Laundry as Picked Up

The agent shall be able to mark the order as collected.

Status:

```text
PICKUP_ASSIGNED
        ↓
PICKED_UP
```

The system shall store:

* Pickup timestamp
* Agent ID
* Actual bag count
* Optional notes

---

# FR-011 Laundry Identification

Every laundry order shall have a unique order number.

Example:

```text
PU-2026-0001
```

The system may generate a QR code associated with the order.

The QR code can be attached to the customer's laundry bag.

---

# FR-012 Shop Receiving

Laundry shop staff shall see incoming orders.

Example:

```text
Incoming Laundry

PU-0001
Ahmed
2 Bags
Picked Up

PU-0002
Fathima
1 Bag
Picked Up
```

Staff can confirm receiving the order.

Status:

```text
PICKED_UP
    ↓
AT_LAUNDRY
```

---

# FR-013 Laundry Processing

Laundry staff shall be able to update the processing status.

Recommended statuses:

```text
AT_LAUNDRY
     ↓
WASHING
     ↓
DRYING
     ↓
IRONING
     ↓
READY
```

---

# FR-014 Price Management

Laundry shop staff shall be able to enter or update the final laundry price.

Example:

```text
Order:
PU-2026-0001

Estimated Items:
15

Final Price:
LKR 1,250
```

The customer shall be able to view the final price.

---

# FR-015 Ready for Delivery

When processing is complete:

```text
IRONING
   ↓
READY
```

The system shall notify the customer that the laundry is ready.

---

# FR-016 Delivery Assignment

An administrator shall be able to assign an agent to deliver completed laundry.

Status:

```text
READY
   ↓
OUT_FOR_DELIVERY
```

---

# FR-017 Delivery Completion

The pickup/delivery agent shall mark the laundry as delivered.

Status:

```text
OUT_FOR_DELIVERY
       ↓
DELIVERED
```

The system shall record:

* Delivery time
* Agent
* Order completion timestamp

---

# FR-018 Order Tracking

Customers shall be able to view the current status of their order.

Example:

```text
PU-2026-0001

✓ Pickup Requested
✓ Pickup Assigned
✓ Clothes Collected
✓ At Laundry Shop
✓ Washing
● Drying
○ Ironing
○ Ready
○ Out for Delivery
○ Delivered
```

---

# FR-019 Order History

Customers shall be able to view previous orders.

Example:

```text
Order       Date          Price       Status

PU-001      01 Sep        LKR 1,200   Delivered
PU-002      20 Aug        LKR 950     Delivered
PU-003      10 Aug        LKR 1,500   Delivered
```

---

# FR-020 Status History

Every status change shall be stored.

Example:

```text
PU-001

10:02 AM
Pickup requested

10:20 AM
Agent assigned

11:05 AM
Laundry collected

11:40 AM
Received at shop

01:00 PM
Washing started

03:30 PM
Ready

05:00 PM
Delivered
```

---

# FR-021 Notifications

The system should notify customers when important events occur.

Notifications may include:

* Pickup confirmed
* Agent assigned
* Laundry collected
* Laundry received
* Laundry ready
* Out for delivery
* Delivered

For the MVP, notifications can be implemented through:

* WhatsApp
* SMS
* In-app notifications

---

# FR-022 Batch Pickup

The system shall allow administrators to group multiple pickup orders for an agent.

Example:

```text
Pickup Route #001

Agent:
Kamal

Orders:

PU-001 → 2 Bags
PU-002 → 1 Bag
PU-003 → 3 Bags
PU-004 → 1 Bag
PU-005 → 2 Bags
```

The agent can process these pickups as one route.

---

# FR-023 Admin Dashboard

The admin dashboard shall provide an overview of:

```text
Today's Orders
Pending Pickups
Active Pickups
At Laundry
Processing
Ready
Out for Delivery
Completed
```

Example:

```text
Today's Overview

New Orders             12
Pickup Assigned          9
Picked Up                7
Processing               5
Ready                    3
Out for Delivery         2
Completed               18
```

---

# FR-024 Customer Management

Administrators shall be able to:

* View customers
* Search customers
* View customer orders
* Disable accounts
* View contact details

---

# FR-025 Agent Management

Administrators shall be able to:

* Create agents
* Edit agents
* Activate/deactivate agents
* Assign orders
* View agent workload

---

# FR-026 Laundry Shop Management

Administrators shall be able to:

* Add laundry shops
* Edit shop information
* Activate/deactivate shops
* Assign orders to shops

For the initial MVP, supporting **one laundry shop** is recommended.

---

# 9. Order Status Model

The primary order state machine should be:

```text
                    ┌──────────────────┐
                    │     PENDING      │
                    └────────┬─────────┘
                             ↓
                    ┌──────────────────┐
                    │ PICKUP_ASSIGNED  │
                    └────────┬─────────┘
                             ↓
                    ┌──────────────────┐
                    │    PICKED_UP     │
                    └────────┬─────────┘
                             ↓
                    ┌──────────────────┐
                    │   AT_LAUNDRY     │
                    └────────┬─────────┘
                             ↓
                    ┌──────────────────┐
                    │     WASHING      │
                    └────────┬─────────┘
                             ↓
                    ┌──────────────────┐
                    │      DRYING      │
                    └────────┬─────────┘
                             ↓
                    ┌──────────────────┐
                    │     IRONING      │
                    └────────┬─────────┘
                             ↓
                    ┌──────────────────┐
                    │      READY       │
                    └────────┬─────────┘
                             ↓
                    ┌──────────────────┐
                    │ OUT_FOR_DELIVERY │
                    └────────┬─────────┘
                             ↓
                    ┌──────────────────┐
                    │    DELIVERED     │
                    └──────────────────┘
```

---

# 10. Database Requirements

## 10.1 Users

```text
users

id
name
phone
email
password_hash
role
is_active
created_at
updated_at
```

Roles:

```text
CUSTOMER
PICKUP_AGENT
SHOP_STAFF
ADMIN
```

---

## 10.2 Addresses

```text
addresses

id
user_id
label
address
area
landmark
latitude
longitude
phone
created_at
updated_at
```

---

## 10.3 Laundry Orders

```text
laundry_orders

id
order_number
customer_id
pickup_agent_id
delivery_agent_id
laundry_shop_id

status

pickup_address_id
pickup_date
pickup_time_slot

bag_count
item_count

price
notes

created_at
updated_at
```

---

## 10.4 Order Status History

```text
order_status_history

id
order_id
status
changed_by
notes
created_at
```

---

## 10.5 Laundry Shops

```text
laundry_shops

id
name
phone
address
latitude
longitude
is_active
created_at
updated_at
```

---

## 10.6 Pickup Routes

```text
pickup_routes

id
agent_id
route_date
status
created_at
updated_at
```

---

## 10.7 Route Orders

```text
route_orders

id
route_id
order_id
sequence
status
```

This allows:

```text
Route #001

1 → PU-001
2 → PU-004
3 → PU-008
4 → PU-011
5 → PU-014
```

---

# 11. Non-Functional Requirements

## 11.1 Performance

The system should:

* Load normal pages within approximately 2–3 seconds under normal conditions.
* Support at least 100 concurrent users for the initial MVP.
* API responses should generally be below 500ms for normal database operations.

---

## 11.2 Security

The system shall:

* Hash passwords.
* Use HTTPS.
* Authenticate API requests.
* Implement role-based authorization.
* Prevent customers from viewing other customers' orders.
* Prevent agents from modifying unauthorized orders.
* Validate all user input.
* Protect sensitive customer information.

---

# 12. Role-Based Access Control

| Feature               | Customer | Agent | Shop | Admin |
| --------------------- | -------: | ----: | ---: | ----: |
| Create Order          |        ✓ |       |      |     ✓ |
| View Own Orders       |        ✓ |       |      |     ✓ |
| View Assigned Orders  |          |     ✓ |      |     ✓ |
| Update Pickup         |          |     ✓ |      |     ✓ |
| View Shop Orders      |          |       |    ✓ |     ✓ |
| Update Laundry Status |          |       |    ✓ |     ✓ |
| Set Price             |          |       |    ✓ |     ✓ |
| Assign Agent          |          |       |      |     ✓ |
| Manage Users          |          |       |      |     ✓ |
| Manage Shops          |          |       |      |     ✓ |
| Reports               |          |       |      |     ✓ |

---

# 13. UI Requirements

## 13.1 Customer Screens

The customer application should contain:

```text
1. Login
2. Register
3. Home
4. Create Pickup
5. Pickup Address
6. Order Confirmation
7. Active Order
8. Order Tracking
9. Order History
10. Profile
11. Addresses
```

---

## 13.2 Agent Screens

```text
1. Login
2. Dashboard
3. Today's Route
4. Pickup Details
5. Pickup Confirmation
6. Delivery List
7. Delivery Details
8. Profile
```

---

## 13.3 Shop Screens

```text
1. Login
2. Dashboard
3. Incoming Laundry
4. Order Details
5. Processing Orders
6. Ready Orders
7. Completed Orders
```

---

## 13.4 Admin Screens

```text
1. Dashboard
2. Orders
3. Customers
4. Agents
5. Laundry Shops
6. Pickup Routes
7. Reports
8. Settings
```

---

# 14. API Requirements

Example API structure:

## Authentication

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

## Customers

```text
GET    /api/customers/profile
PUT    /api/customers/profile
GET    /api/customers/addresses
POST   /api/customers/addresses
PUT    /api/customers/addresses/:id
DELETE /api/customers/addresses/:id
```

## Orders

```text
POST   /api/orders
GET    /api/orders
GET    /api/orders/:id
POST   /api/orders/:id/cancel
GET    /api/orders/:id/status-history
```

## Agent

```text
GET  /api/agent/orders
GET  /api/agent/orders/:id
POST /api/agent/orders/:id/pickup
POST /api/agent/orders/:id/deliver
```

## Shop

```text
GET   /api/shop/orders
GET   /api/shop/orders/:id
PATCH /api/shop/orders/:id/status
PATCH /api/shop/orders/:id/price
```

## Admin

```text
GET   /api/admin/orders
POST  /api/admin/orders/:id/assign-agent
GET   /api/admin/customers
GET   /api/admin/agents
POST  /api/admin/agents
GET   /api/admin/shops
POST  /api/admin/shops
```

---

# 15. Recommended Technology Stack

## Frontend

```text
Next.js
TypeScript
Tailwind CSS
```

A responsive web application is recommended instead of separate native applications for the MVP.

---

## Backend

```text
Node.js
TypeScript
```

Possible framework:

```text
NestJS
```

or:

```text
Express / Fastify
```

---

## Database

```text
PostgreSQL
```

ORM:

```text
Prisma
```

---

## Authentication

For the Puttalam market:

```text
Phone Number
+
OTP
```

can eventually provide a better user experience than traditional email/password authentication.

For the initial development version, email/password can also be used.

---

## Maps

Use a map provider for:

* Address selection
* Location coordinates
* Navigation
* Future route optimization

The MVP only needs basic location support.

---

# 16. MVP Architecture

```text
                    ┌───────────────┐
                    │   Customer    │
                    └───────┬───────┘
                            │
                    ┌───────▼───────┐
                    │   Next.js     │
                    │   Frontend    │
                    └───────┬───────┘
                            │
                         REST API
                            │
                    ┌───────▼───────┐
                    │    Backend    │
                    │ Node.js/TS    │
                    └───────┬───────┘
                            │
                     ┌──────┴──────┐
                     │             │
              ┌──────▼─────┐ ┌────▼─────┐
              │ PostgreSQL │ │   Redis  │
              │   Prisma   │ │ Optional │
              └────────────┘ └──────────┘
```

Redis should be optional for the first version.

---

# 17. Core Business Rules

## BR-001

A customer cannot create an order without a valid pickup address.

## BR-002

An order must have a unique order number.

## BR-003

Only an administrator can assign a pickup agent.

## BR-004

An agent can only update orders assigned to them.

## BR-005

Only shop staff or administrators can update laundry processing status.

## BR-006

An order cannot be marked as delivered before it reaches `OUT_FOR_DELIVERY`.

## BR-007

Every order status change must be recorded.

## BR-008

A customer can only view their own orders.

## BR-009

A completed order cannot be modified except by an administrator.

## BR-010

The final price can be updated by authorized shop staff or administrators.

---

# 18. Error Handling

The system should handle:

### Invalid address

```text
"Please provide a valid pickup address."
```

### Invalid pickup date

```text
"Please select a valid pickup date."
```

### Agent unavailable

```text
"No pickup agent is currently available."
```

### Unauthorized access

```text
"You do not have permission to perform this action."
```

### Invalid status transition

```text
"This order cannot be moved to the selected status."
```

---

# 19. Notifications

MVP notification events:

| Event              | Customer | Agent | Shop |
| ------------------ | -------: | ----: | ---: |
| New Order          |        ✓ |       |    ✓ |
| Agent Assigned     |        ✓ |     ✓ |      |
| Laundry Picked Up  |        ✓ |       |    ✓ |
| Laundry Received   |        ✓ |       |      |
| Processing Started |        ✓ |       |      |
| Laundry Ready      |        ✓ |       |      |
| Delivery Assigned  |        ✓ |     ✓ |      |
| Delivered          |        ✓ |       |      |

---

# 20. MVP Acceptance Criteria

The MVP will be considered successful when the following workflow works completely:

```text
1. Customer creates account
        ↓
2. Customer creates laundry request
        ↓
3. Admin sees request
        ↓
4. Admin assigns agent
        ↓
5. Agent sees request
        ↓
6. Agent collects laundry
        ↓
7. Agent marks "Picked Up"
        ↓
8. Shop receives laundry
        ↓
9. Shop marks "Washing"
        ↓
10. Shop marks "Drying"
        ↓
11. Shop marks "Ironing"
        ↓
12. Shop marks "Ready"
        ↓
13. Agent receives delivery assignment
        ↓
14. Agent delivers laundry
        ↓
15. Agent marks "Delivered"
        ↓
16. Customer sees completed order
```

---

# 21. MVP Development Priorities

## Priority 1 — Must Have

```text
✓ Authentication
✓ Customer
✓ Laundry Order
✓ Pickup Address
✓ Agent
✓ Agent Assignment
✓ Pickup Status
✓ Shop Dashboard
✓ Laundry Status
✓ Price
✓ Customer Tracking
✓ Delivery
✓ Admin Dashboard
```

## Priority 2 — Should Have

```text
✓ QR code
✓ Notifications
✓ Status history
✓ Saved addresses
✓ Pickup routes
```

## Priority 3 — Later

```text
○ Online payments
○ WhatsApp automation
○ GPS tracking
○ Route optimization
○ Subscription
○ Multiple laundry shops
○ Analytics
○ Loyalty
```

---

# 22. Suggested MVP Timeline

## Week 1 — Foundation

```text
Day 1
Project setup
Database
Authentication

Day 2
Users
Roles
Addresses

Day 3
Customer UI

Day 4
Laundry order creation

Day 5
Order tracking
```

## Week 2 — Operations

```text
Day 6
Agent dashboard

Day 7
Agent assignment

Day 8
Pickup workflow

Day 9
Laundry shop dashboard

Day 10
Laundry processing
```

## Week 3 — Delivery

```text
Day 11
Delivery workflow

Day 12
Status history

Day 13
Notifications

Day 14
QR codes

Day 15
Testing
```

## Week 4 — Pilot

```text
Deploy

Connect:
1 Laundry Shop
1 Pickup Agent

Recruit:
20–50 Customers

Run real orders.
```

---

# 23. Success Metrics

The MVP should measure:

### Customer

```text
Number of registered customers
Number of first orders
Repeat order rate
Average orders/customer
Cancellation rate
```

### Operations

```text
Average pickup time
Orders per pickup route
Orders per agent
Average processing time
Average delivery time
Failed pickups
```

### Business

```text
Revenue/order
Laundry shop payout
Pickup cost/order
Delivery cost/order
Gross margin/order
Customer acquisition cost
Customer lifetime value
```

The most important initial metrics are:

> **Repeat order rate + orders per pickup route + contribution margin per order.**

---

# 24. Future Architecture

Once the MVP proves demand, the platform can evolve into:

```text
                    Puttalam Laundry Platform

                           Platform
                              │
            ┌─────────────────┼─────────────────┐
            │                 │                 │
            ▼                 ▼                 ▼
       Laundry Shop A    Laundry Shop B    Laundry Shop C
            │                 │                 │
            └─────────────────┼─────────────────┘
                              │
                       Pickup Network
                              │
             ┌────────────────┼────────────────┐
             ▼                ▼                ▼
          Zone A            Zone B           Zone C
```

Future capabilities:

* Automatic route optimization
* Multiple laundry shops
* Dynamic pricing
* Online payments
* WhatsApp ordering
* Customer subscriptions
* Business accounts
* Hotel/hostel accounts
* Driver optimization
* Analytics
* Demand prediction

---

# 25. Final MVP Definition

The first version should **not** attempt to become a complete laundry marketplace.

The MVP is:

> **A system that allows customers in Puttalam to request laundry pickup, allows one pickup agent to collect multiple orders, allows a laundry shop to process and track those orders, and allows customers to see the status until their laundry is delivered back to them.**

The critical loop is:

```text
REQUEST
   ↓
COLLECT
   ↓
PROCESS
   ↓
READY
   ↓
DELIVER
   ↓
REPEAT
```

If this loop works reliably with real customers, the next step is to optimize the logistics rather than add more software features.

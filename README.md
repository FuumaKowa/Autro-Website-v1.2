

````md
# Autro Furniture Rental Website

Autro is a furniture rental and rent-to-own website built for customers, agents, and administrators. The website allows customers to browse furniture, rent individual items or packages, and connect orders to agents. Admins can manage catalog items, packages, agents, rental records, commissions, and business analysis.

## Overview

Autro focuses on warm minimalist furniture rental. The system supports individual furniture rental, curated furniture packages, agent-linked orders, rental payment tracking, and ownership transfer after the full rental duration and payment completion.

## Features

### Customer

- Browse furniture items
- Browse curated furniture packages
- View rental pricing by duration
- Submit rental requests
- Add agent email during checkout
- Use English or Chinese language option

### Agent

- Login to agent dashboard
- View sales connected to their account
- Track commission and sales performance

### Admin

- Manage furniture catalog
- Manage package listings
- Manage agents
- View rental orders
- Track commissions
- View data analysis dashboard
- Manage active rentals
- Record monthly payments
- Track payment progress
- Confirm ownership transfer
- Move completed records to archive
- Review archived rental records

## Rental Workflow

Autro uses a rental-based workflow instead of a normal ecommerce order status system.

### Rental Status

```txt
active
ownership_pending
ownership_transferred
cancelled
defaulted
````

### Payment Status

```txt
on_time
due_soon
overdue
behind_schedule
fully_paid
closed
```

### Archive Status

```txt
active
archived
```

A new rental starts as `active` and `on_time`. Admin can update the payment progress as the customer pays monthly. Once all payments are completed and the rental period is finished, ownership can be transferred. Completed records can then be moved into the archive.

## Admin Data Analysis

The admin dashboard includes:

* Total rental value
* Total orders
* Completed or fully paid rentals
* Rentals that need attention
* Commission summary
* Average order value
* Monthly rental value chart
* Rental health chart
* Recent rental records
* System-generated admin insights

The system can generate tips such as:

* Customers with overdue payments
* Payments due soon
* Fully paid rentals needing ownership transfer
* Best-performing furniture or packages
* Top-performing agents
* Agents without active rental sales

## Main Pages

```txt
index.html
furniture.html
packages.html
about.html
partners.html
agent-login.html
agent-dashboard.html
admin-login.html
admin.html
admin-packages.html
admin-agents.html
admin-analysis.html
admin-rentals.html
admin-archive.html
```

## Technologies Used

* HTML
* CSS
* JavaScript
* Supabase
* Chart.js
* GitHub
* Vercel

## Database

The project uses Supabase for database storage and authentication.

Main tables:

```txt
furniture_items
packages
agents
rental_orders
commissions
```

Important rental order fields:

```txt
rental_status
payment_status
archive_status
rental_start_date
rental_end_date
rental_duration_months
monthly_payment
total_amount
amount_paid
paid_months
missed_payments
next_payment_date
ownership_transferred
ownership_transfer_date
archived_at
updated_at
```

## Setup

Clone the repository.

```bash
git clone <repository-url>
```

Open the project folder.

```bash
cd <project-folder>
```

Configure Supabase inside `auth.js`.

```js
const supabaseUrl = "YOUR_SUPABASE_URL";
const supabaseKey = "YOUR_SUPABASE_ANON_KEY";
```

Run the project using a local server such as VS Code Live Server.

```txt
http://127.0.0.1:5500/index.html
```

## Deployment

This project can be deployed with Vercel.

```bash
git add .
git commit -m "Update project"
git push
```

Then connect the GitHub repository to Vercel and deploy from the selected branch.

## Current Status

The current version includes customer rental submission, furniture and package browsing, admin catalog management, agent management, commission tracking, rental analytics, rental management, archive workflow, and system-generated admin insights.

## Future Improvements

* Customer login system
* Payment gateway integration
* Automatic payment reminders
* Invoice generation
* Report export as PDF or CSV
* Admin notification system
* Package builder from selected furniture items
* More detailed customer rental history

````

Copy this into a file named:

```txt
README.md
````

Then run:

```bash
git add README.md
git commit -m "Add project README"
git push
```

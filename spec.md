1. Summary

This document proposes functional and user flow changes for the GoodHours application, aiming for a safe and growth-minded go-to-market strategy. The application is designed for High Schools to manage and track student volunteering hours required for graduation.

For the short to medium term:

Focus on core functionality

Revenue model is intentionally de-emphasized

2. Core Tenets (Design Principles)
2.1 Three-Way Relationship

The system is built around a tripartite relationship, with the School acting as the orchestrator:

School

Student

Beneficiary

(Relationship: School sits in the middle connecting Student and Beneficiary)

2.2 School as Primary User and Custodian

School is the primary user and entry point

School maintains control over the entire process

Must implement end-to-end data encryption

2.3 Minimal Friction

Application is free for schools

2.4 Minimal Data Collection

Collect the absolute minimum information required

2.5 Simplified Onboarding

All user registration is initiated through the School

2.6 Delayed Monetization

Avoid setting up company + bank accounts early

Monetization deferred

3. User Roles

Schools (School Admin)

Students

Beneficiaries (Beneficiary Admin)

4. Functional Requirements
4.1 Data Collection and System Administration

Create list of all Public, Charter, Private High Schools (US)

Public_Schools.csv

Private_Schools.csv

Create list of all Beneficiaries (US)

eo_ma.csv

Collect geographic metadata:

Street names

Location

Map as points

Organize Beneficiaries by categories

Periodic refresh:

Add new

Update

Remove inactive

4.2 School Administrator Functionality
4.2.1 School Setup (Registration)

Available in Google Classroom Marketplace

Uses Google OAuth

Landing Page Rules

Only Schools can register

Flow

Search school (type-ahead UX)

If registered:

Show message → contact registered email

If not registered:

Show “Register” button

Send magic link email

4.2.2 School Admin Operations
Beneficiary Management

View nearby Beneficiaries (zip-based, categorized)

Approve Beneficiaries

Add/drop anytime

Custom Beneficiary Creation

Add if not found

Flags:

Public → can be added to global directory (after approval)

Private → limited to that school

Student Self-Submitted Volunteering

View requests

Approve/reject with reason

4.2.3 School Admin Landing Page

First visit:

Map view of school + nearby Beneficiaries

Zillow-style UI (map + list)

Page name:

Beneficiary Discover Page

Function:

Browse + approve Beneficiaries

Blue-check style approval

Persistent access

4.3 Beneficiary Administrator Functionality
4.3.1 Beneficiary Setup (Registration)

Invitation-only

Flow

School approves Beneficiary

Email sent

Link to register

Existing Beneficiaries

Notify of new school

Accept or decline (option: no opportunities)

Profile Update

Can edit pre-filled public data

4.3.2 Beneficiary Admin Operations

Track invitations:

Received

Accepted

Declined

Opportunity Creation

Calendar-based UX

Inputs:

Start date

End date

Time slots

Work type

Requirements

Student Signups

View count

Reveal details after first visit

Expectations

Define clear expectations

Approval

Approve hours

4.4 Student Functionality
4.4.1 Student Setup (Enrollment)
Cohort Creation

Created by School Admin

Example: “Graduating 2029”

Operations

Bulk import

Add/update/delete

Student Data

Name

Email

House

Cohort Settings

Duration

Required hours

Registration

Invitation-only (magic link)

4.4.2 Student Operations

View cohort

View required credits

View approved Beneficiaries

View opportunities

Sign-Up

Calendar-based

Reminders

Event notifications

Progress Tracking

Graduation progress

Self-Selected Volunteering

Submit custom work

School approval required
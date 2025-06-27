# Ai2Bi Platform Website

This repository contains the website for the Ai2Bi Platform, a bespoke generative AI solution developed as part of the Datacentrix AI Resource Center (ARC).

## Project Structure

```
/ai2bi-website
│
├── index.html        -- Home page with upload functionality
├── chat.html         -- Chat interface page
├── style.css         -- Shared CSS styles
├── assets/
│   └── datacentrix-logo.png   -- Datacentrix logo image
└── README.md         -- This file
```

## Pages

### Home Page (index.html)
- Project information
- Features overview
- Document upload functionality
- Process workflow

### Chat Interface (chat.html)
- Embedded N8N chat interface
- Sample questions
- Features list
- AI capabilities information

## Features

- Responsive design for all device sizes
- Embedded N8N workflows for document upload and chatbot functionality
- Modern UI with a focus on user experience
- Clear visualization of the platform capabilities

## Setup Instructions

1. Download or clone this repository
2. Replace `assets/datacentrix-logo.png` with the actual Datacentrix logo
3. Host the files on a web server
4. No server-side code is required as the functionality is provided by the embedded N8N workflows

## N8N Workflow URLs

- Document Upload Form: `https://kkarodia.app.n8n.cloud/form/8484ec1d-7c0c-42e4-ab9e-332bb8ea7243`
- Chat Interface: `https://kkarodia.app.n8n.cloud/webhook/7c089ff0-3fd4-4b5f-bb76-eff2d51345de/chat`

## Technologies Used

- HTML5
- CSS3
- JavaScript (minimal)
- Font Awesome (for icons)
- Google Fonts (Poppins)
- N8N (workflow automation platform)

---

Developed for Datacentrix ARC - 2025

[![Netlify Status](https://api.netlify.com/api/v1/badges/2334df75-954f-4802-87c1-2eea3a811b60/deploy-status)](https://app.netlify.com/sites/datacentrix-ai2bi/deploys)

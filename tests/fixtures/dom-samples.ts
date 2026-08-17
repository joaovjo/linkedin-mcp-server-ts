export const DOM_PROFILE_HTML = `
<!DOCTYPE html>
<html>
<head><title>Jane Doe | LinkedIn</title></head>
<body>
  <div class="pv-top-card">
    <h1 class="text-heading-xlarge">Jane Doe</h1>
    <div class="text-body-medium">Senior Software Engineer at Acme Corp</div>
    <span class="text-body-small">San Francisco, California, United States</span>
    <a href="/in/janedoe/" class="ember-view">Profile URL</a>
  </div>
  <section id="about" class="artdeco-card pv-about-section">
    <div class="display-flex"><h2>About</h2></div>
    <div class="inline-show-more-text">Passionate software engineer building resilient distributed systems and MCP servers.</div>
  </section>
  <section id="experience" class="artdeco-card">
    <h2>Experience</h2>
    <div class="experience-item">
      <h3>Senior Software Engineer</h3>
      <h4>Acme Corp · Full-time</h4>
      <p>Jan 2022 - Present · 4 yrs</p>
    </div>
  </section>
  <section id="education" class="artdeco-card">
    <h2>Education</h2>
    <div class="education-item">
      <h3>Stanford University</h3>
      <p>Bachelor of Science - BS, Computer Science</p>
    </div>
  </section>
  <section id="skills" class="artdeco-card">
    <h2>Skills</h2>
    <ul>
      <li>TypeScript</li>
      <li>Bun</li>
      <li>Distributed Systems</li>
    </ul>
  </section>
</body>
</html>
`;

export const DOM_COMPANY_HTML = `
<!DOCTYPE html>
<html>
<head><title>Acme Corp | LinkedIn</title></head>
<body>
  <div class="org-top-card">
    <h1 class="org-top-card-summary__title">Acme Corp</h1>
    <p class="org-top-card-summary__tagline">Building modern tools for developers worldwide.</p>
    <div class="org-top-card-summary-info-list">
      <div class="org-top-card-summary-info-list__info-item">Software Development</div>
      <div class="org-top-card-summary-info-list__info-item">San Francisco, CA</div>
      <div class="org-top-card-summary-info-list__info-item">1,001-5,000 employees</div>
    </div>
    <a href="https://acme.example.com" class="org-top-card-primary-actions__action">Website</a>
  </div>
  <section class="artdeco-card org-page-details-module__card">
    <h2>Overview</h2>
    <p>Acme Corp is a leading technology company transforming developer infrastructure.</p>
  </section>
</body>
</html>
`;

export const DOM_JOB_HTML = `
<!DOCTYPE html>
<html>
<head><title>Senior Backend Engineer - Acme Corp | LinkedIn</title></head>
<body>
  <div class="job-details-jobs-unified-top-card__content--two-pane">
    <h1 class="job-details-jobs-unified-top-card__job-title">Senior Backend Engineer</h1>
    <div class="job-details-jobs-unified-top-card__company-name">
      <a href="/company/acme-corp/">Acme Corp</a>
    </div>
    <div class="job-details-jobs-unified-top-card__primary-description-container">
      <span>San Francisco, CA (Hybrid)</span>
      <span>· 2 weeks ago</span>
      <span>· Over 100 applicants</span>
    </div>
    <div class="jobs-box__html-content">
      <h2>About the job</h2>
      <p>We are looking for a Senior Backend Engineer proficient in TypeScript, Bun, and high-performance server architectures.</p>
    </div>
  </div>
</body>
</html>
`;

export const DOM_FEED_HTML = `
<!DOCTYPE html>
<html>
<head><title>Feed | LinkedIn</title></head>
<body>
  <main>
    <div class="feed-shared-update-v2" data-urn="urn:li:activity:7123456789012345678">
      <div class="feed-shared-actor">
        <a href="/in/alice/" class="app-aware-link">Alice Smith</a>
        <span class="feed-shared-actor__description">Staff Engineer at CloudTech</span>
      </div>
      <div class="feed-shared-update-v2__description-wrapper">
        <span>Excited to announce our new open source MCP server written in Bun! #typescript #mcp</span>
      </div>
    </div>
  </main>
</body>
</html>
`;

export const DOM_MESSAGING_HTML = `
<!DOCTYPE html>
<html>
<head><title>Messaging | LinkedIn</title></head>
<body>
  <div class="msg-conversations-container">
    <ul class="msg-conversations-container__conversations-list">
      <li class="msg-conversation-listitem" data-thread-id="urn:li:msg_thread:abc123456">
        <a href="/messaging/thread/abc123456/" class="msg-conversation-listitem__link">
          <h3 class="msg-conversation-listitem__participant-names">Bob Johnson</h3>
          <p class="msg-conversation-card__snippet">Thanks for connecting! Let's chat soon.</p>
        </a>
      </li>
    </ul>
  </div>
</body>
</html>
`;

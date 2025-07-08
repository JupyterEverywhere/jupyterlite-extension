import React from 'react';
import { createRoot } from 'react-dom/client';

import jeOctopus from '../style/icons/landing/je-octopus.svg';
import octopusOutline from '../style/icons/landing/je-octopus-outline.svg';
import jupyterEverywhereText from '../style/icons/landing/jupytereverywhere-text.svg';

import pythonLogo from '../style/icons/landing/python.svg';
import rLogo from '../style/icons/landing/r.svg';

import scrolldownArrow from '../style/icons/landing/scrolldown-arrow.svg';

import codeSymbol from '../style/icons/landing/code.svg';
import shareIcon from '../style/icons/landing/share.svg';
import jupyterLogo from '../style/icons/landing/jupyter.svg';

import testimonialAvatar from '../style/icons/landing/testimonial.svg';

// TODO: get SVGs for these logos
// import courseKataLogo from '../style/icons/landing/coursekata.svg';
// import skewTheScriptLogo from '../style/icons/landing/skewthescript.svg';

// TODO: find a better way to handle these imports
import '../style/landing.css';
import '../style/base.css';

/**
 * LandingPage component renders the landing page for Jupyter Everywhere.
 * It includes a header, hero section with buttons to create notebooks,
 * a features section, a testimonial, an about section, and a footer.
 * @returns Landing page component
 */
function LandingPage(): JSX.Element {
  // Placeholder function for upload functionality
  const handleUpload = () => {
    alert('Upload functionality not yet implemented.');
  };

  const handleScrollToFeatures = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const featuresSection = document.getElementById('features');
    if (featuresSection) {
      featuresSection.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  };

  return (
    <div className="je-landing">
      {/* Hero section */}
      <section className="je-hero">
        <div className="je-header">
          <img src={jeOctopus} className="je-logo" alt="Logo" />
          <button className="je-tutorial-button">Tutorial</button>
        </div>

        <main className="je-main">
          <h2 className="je-brand">Welcome to</h2>
          <h1>
            <span className="je-brand">Jupyter Everywhere</span>
          </h1>

          <div className="je-buttons">
            <a href="/lab/index.html?notebook=Untitled.ipynb&kernel=python" className="je-card">
              <p>Create Python Notebook</p>
              <img src={pythonLogo} alt="Python logo" />
            </a>

            <a href="/lab/index.html?notebook=Untitled.ipynb&kernel=xr" className="je-card">
              <p>Create R Notebook</p>
              <img src={rLogo} alt="R logo" />
            </a>
          </div>
          <a
            href="#"
            className="je-upload"
            onClick={e => {
              e.preventDefault();
              handleUpload();
            }}
          >
            Upload a Notebook
          </a>
        </main>

        <div className="je-hero-bottom">
          <a href="#features" className="je-scroll-indicator" onClick={handleScrollToFeatures}>
            Scroll to learn more
            <br />
            <img src={scrolldownArrow} alt="An arrow that scrolls down when clicked" />
          </a>
        </div>
      </section>

      {/* Features section */}
      <section id="features" className="je-features">
        <h2>Features</h2>
        <div className="je-features-grid">
          <div className="je-feature">
            <img src={codeSymbol} alt="Code symbol" />
            <h3>Code Ready</h3>
            <p>
              You can choose between the Python and R languages to create classroom friendly
              interactive notebooks
            </p>
          </div>

          <div className="je-feature">
            <img src={shareIcon} alt="Share icon" />
            <h3>Shareable</h3>
            <p>
              You can easily generate a shareable link that will allow you to share your work with
              others or come back to it later
            </p>
          </div>

          <div className="je-feature">
            <img src={jupyterLogo} alt="Jupyter logo" />
            <h3>Jupyter Compatible</h3>
            <p>Notebooks are compatible with the JupyterLab and Jupyter notebooks ecosystems</p>
          </div>
        </div>
      </section>

      {/* Testimonial section */}
      <section className="je-testimonial">
        <img src={testimonialAvatar} alt="User avatar" className="je-avatar" />
        <blockquote>
          "This application makes it so much easier for us to focus on the lesson and not on
          technical issues. I have already recommended it to others."
        </blockquote>
      </section>

      <section className="je-about">
        <p>
          Jupyter Everywhere (JE) is a collaborative project between Skew the Script and CourseKata,
          launched in 2024 with support from the Gates Foundation. Our initiative focuses on
          bringing data science tools and resources into classrooms by providing access to
          high-quality tools. Our goal is to empower teachers and students to explore data science
          and statistics easily, fostering deeper engagement and understanding in these essential
          fields.
        </p>
      </section>

      <section className="je-partner-logos">
        {/* Logos aren't working... only SVGs work right now */}
        <img src="../style/icons/landing/coursekata.png" alt="CourseKata logo" />
        <img src="../style/icons/landing/skewthescript.jpeg" alt="Skew The Script logo" />
      </section>

      <footer className="je-footer">
        <div className="je-footer-brand">
          <img src={octopusOutline} className="je-footer-logo" alt="Jupyter Everywhere Logo" />
          <img src={jupyterEverywhereText} className="je-footer-text" alt="Jupyter Everywhere" />
        </div>

        <div className="je-footer-links-container">
          <div className="je-footer-section">
            <h4>Stay Connected</h4>
            <a href="#">Join Community Forum</a>
            <a href="#">Submit a question</a>
          </div>

          <div className="je-footer-section">
            <h4>Follow us</h4>
            <a href="https://github.com/Skew-The-Script">GitHub</a>
            <a href="https://www.youtube.com/@skewthescript">YouTube</a>
          </div>
        </div>
      </footer>

      <div className="je-footer-bottom">
        <p>
          Jupyter Everywhere is a collaboration between{' '}
          <a href="https://www.coursekata.org/">CourseKata</a> and{' '}
          <a href="https://skewthescript.org/">Skew The Script</a>, made possible through support
          from the <a href="https://www.gatesfoundation.org/">Gates Foundation</a>. Copyright ©
          2025. All rights reserved.
        </p>
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<LandingPage />);

import React, { useRef } from 'react';
import { createRoot } from 'react-dom/client';

import { handleNotebookUpload } from './upload';

import jeOctopus from '../style/icons/je-octopus.svg';

import jupyterEverywhereText from '../style/icons/landing/jupytereverywhere-text.svg';

import pythonLogo from '../style/icons/landing/python.svg';
import rLogo from '../style/icons/landing/r.svg';

import scrolldownArrow from '../style/icons/landing/scrolldown-arrow.svg';

import codeSymbol from '../style/icons/landing/code.svg';
import shareIcon from '../style/icons/landing/share.svg';
import jupyterLogo from '../style/icons/landing/jupyter.svg';

import testimonialAvatar from '../style/icons/landing/testimonial.svg';

// TODO: get SVGs for these logos
import courseKataLogo from '../static/coursekata.png';
import skewTheScriptLogo from '../static/skewthescript.jpeg';

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
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleUploadClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    inputRef.current?.click();
  };

  const handleFileChanged = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    await handleNotebookUpload(file);
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
          <h1>
            <span className="je-brand je-welcome">Welcome to</span>
            <span className="je-brand">Jupyter Everywhere</span>
            <span className="je-brand" style={{ color: 'black' }}>
              Beta
            </span>
          </h1>

          <div className="je-buttons">
            <a href="lab/index.html?kernel=python" className="je-card">
              <p>Create Python Notebook</p>
              <img src={pythonLogo} alt="Python logo" />
            </a>

            <a href="lab/index.html?kernel=r" className="je-card">
              <p>Create R Notebook</p>
              <img src={rLogo} alt="R logo" />
            </a>
          </div>
          <a href="#" className="je-upload" onClick={handleUploadClick}>
            Upload a Notebook
          </a>
          <input
            type="file"
            accept=".ipynb,application/json"
            style={{ display: 'none' }}
            ref={inputRef}
            onChange={handleFileChanged}
          />
        </main>

        <div className="je-hero-bottom">
          <a href="#features" className="je-scroll-indicator">
            Scroll to learn more
            <br />
            <img src={scrolldownArrow} alt="" aria-hidden="true" />
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
          “This application makes it so much easier for us to focus on the lesson and not on
          technical issues. I have already recommended it to others.”
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
        <img src={courseKataLogo} alt="CourseKata logo" />
        <img src={skewTheScriptLogo} alt="Skew The Script logo" />
      </section>

      <footer className="je-footer">
        <div className="je-footer-brand">
          <img src={jeOctopus} className="je-footer-logo" alt="Jupyter Everywhere Logo" />
          <img src={jupyterEverywhereText} className="je-footer-text" alt="Jupyter Everywhere" />
        </div>

        <div className="je-footer-links-container">
          <div className="je-footer-section">
            <h4>Stay Connected</h4>
            <a href="https://jupytereverywhere.freeflarum.com">Join Community Forum</a>
            <a href="https://forms.gle/DG42BpS8EKpmNCFD9">Submit a question</a>
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

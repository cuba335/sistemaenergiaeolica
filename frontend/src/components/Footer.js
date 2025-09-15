import React from "react";
import { FaFacebook, FaWhatsapp, FaInstagram } from "react-icons/fa";


function Footer() {
  return (
    <footer className="footer">
      <div className="social-icons">
        <a
          href="https://www.facebook.com/share/1FSYQgdGmd/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Facebook"
        >
          <FaFacebook />
        </a>
        <a
            href="https://wa.me/59169529957" // ¡Aquí está la modificación!
          target="_blank"
          rel="noopener noreferrer"
          aria-label="WhatsApp"
        >
          <FaWhatsapp />
        </a>
        <a
          href="https://www.instagram.com/sistemas_eolicos?igsh=NTFrZGpucDhlNXVq"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Instagram"
        >
          <FaInstagram />
        </a>
      </div>
      <div className="footer-text">
        © 2025 Sistema Eólico 
      </div>
    </footer>
  );
}

export default Footer;

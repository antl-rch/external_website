import "./legal.scss";

import { useCookieConsent } from "../../hooks";
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import Header from "../../components/header/Header";
import BackgroundCircle from "../../components/backgroundCircle/BackgroundCircle";
import BackgroundGrid from "../../components/backgroundGrid/BackgroundGrid";
import Footer from "../../components/footer/Footer";

export default function Legal(): ReactElement {
  const { t } = useTranslation();
  const { openPreferences } = useCookieConsent();

  return (
    <div id="legal">
      <BackgroundCircle />
      <BackgroundGrid />
      <Header />
      <main className="container legalContainer">
        <h1 className="legalTitle">{t("legal.title")}</h1>
        <section className="legalSection">
          <div className="legalContent">
            <p>{t("legal.companyInfo")}</p>
            <p>{t("legal.activity")}</p>
            <p>{t("legal.director")}</p>
            <p>{t("legal.hosting")}</p>
            <h3>{t("legal.contactTitle")}</h3>
            <ul>
              <li>{t("legal.contactPhone")}</li>
              <li>{t("legal.contactEmail")}</li>
              <li>{t("legal.contactAddress")}</li>
            </ul>
            <p>{t("legal.rights")}</p>
          </div>
        </section>
        <section id="confidentialite" className="legalSection" aria-labelledby="privacy-heading">
          <div className="legalContent">
            <h2 id="privacy-heading">{t("privacy.title")}</h2>
            {[0, 1, 2, 3].map(index => <p key={index}>{t(`privacy.paragraphs.${index}`)}</p>)}
            <p><a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">{t("privacy.google")}</a> · <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer">{t("privacy.cloudflare")}</a></p>
            <button type="button" className="cookie-settings-button" onClick={openPreferences}>{t("cookieConsent.settings")}</button>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

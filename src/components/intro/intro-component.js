import React from 'react';
import './intro.scss';
import SocialIcons from '../../components/social-icons/social-icons';
import IntroSplash from './intro-splash';
import { ReactComponent as Mouse } from '../../assets/mouse.svg';
import { ReactComponent as Arrow } from '../../assets/arrow.svg';
import { useTranslation } from 'react-i18next';

const Intro = ({ title, subtitle, date, datePrefix, social, height }) => {
  const { t } = useTranslation();
  const heightStyle = height ? { height: `${height}px` } : undefined;
  const separatorClasses = 'h-px bg-white block flex-1 opacity-25';
  return (
    <div className="intro step absolute h-screen w-full" style={heightStyle}>
      <IntroSplash />
      <div
        className="intro-content absolute h-screen w-full flex flex-col justify-center items-center"
        style={heightStyle}
      >
        <div className="container max-w-xl text-white text-center mb-10">
          <h1 className="title font-lora mb-10">{t(title)}</h1>
          <h2 className="text-lg font-regular">{t(subtitle)}</h2>
        </div>
        <div className="container max-w-xl text-white">
          {date && (
            <div className="text-xs font-bold text-white flex items-center mb-6">
              <span className={separatorClasses} />
              {/* datePrefix is optional and carries any qualifier the story
                  needs before the credit, e.g. while a publication date is
                  still provisional. Kept separate from 'Published' so that
                  word stays a stable translation key. */}
              <span className="font-bold uppercase px-1">
                {`${datePrefix ? `${t(datePrefix)} ` : ''}${t('Published')} ${t(date)}`}
              </span>
              <span className={separatorClasses} />
            </div>
          )}
        </div>
        <div className="container max-w-sm text-gray-100 text-center flex flex-col justify-center items-center">
          <div className="mb-5 flex flex-col items-center">
            <Mouse className="opacity-75 fill-current w-5 mb-1" />
            <Arrow className="arrow-animate opacity-75 fill-current w-3 mb-1/2" />
            <Arrow className="arrow-animate opacity-75 fill-current w-3" />
          </div>
          {t('Scroll down, but not too fast')}
        </div>
        {social && <SocialIcons social={social} className="absolute bottom-0 left-0 ml-3 mb-3" />}
      </div>
    </div>
  );
};

export default Intro;

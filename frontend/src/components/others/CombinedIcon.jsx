import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import './CombinedIcon.css';

const CombinedIcon = ({ baseIcon, overlayIcon, size = '1x' }) => {
    return (
        <span className="icon-stack" style={{ fontSize: size }}>
            <FontAwesomeIcon icon={baseIcon} className="base-icon" />
            {overlayIcon && <FontAwesomeIcon icon={overlayIcon} className="overlay-icon" />}
        </span>
    );
};

export default CombinedIcon;
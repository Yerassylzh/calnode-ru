import * as core from './core';
import * as home from './home';
import * as auth from './auth';
import * as bookings from './bookings';
import * as eventTypes from './eventTypes';
import * as eventTypeDetail from './eventTypeDetail';
import * as questionsPanel from './questionsPanel';
import * as embedPanel from './embedPanel';
import * as availability from './availability';
import * as doctorBreaks from './doctorBreaks';
import * as members from './members';
import * as recordings from './recordings';
import * as apiKeys from './apiKeys';
import * as settingsLayout from './settingsLayout';
import * as settingsProfile from './settingsProfile';
import * as settingsEmail from './settingsEmail';
import * as settingsVideo from './settingsVideo';
import * as settingsStorage from './settingsStorage';
import * as settingsNotifications from './settingsNotifications';
import * as schedule from './schedule';
import * as shared from './shared';

export const en = Object.assign({}, core.en, home.en, auth.en, bookings.en, eventTypes.en, eventTypeDetail.en, questionsPanel.en, embedPanel.en, availability.en, doctorBreaks.en, members.en, recordings.en, apiKeys.en, settingsLayout.en, settingsProfile.en, settingsEmail.en, settingsVideo.en, settingsStorage.en, settingsNotifications.en, schedule.en, shared.en);

export const ru = Object.assign({}, core.ru, home.ru, auth.ru, bookings.ru, eventTypes.ru, eventTypeDetail.ru, questionsPanel.ru, embedPanel.ru, availability.ru, doctorBreaks.ru, members.ru, recordings.ru, apiKeys.ru, settingsLayout.ru, settingsProfile.ru, settingsEmail.ru, settingsVideo.ru, settingsStorage.ru, settingsNotifications.ru, schedule.ru, shared.ru);

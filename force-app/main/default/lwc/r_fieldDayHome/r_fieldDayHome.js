import { LightningElement, track, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import USER_ID from '@salesforce/user/Id';
import { getRecord } from 'lightning/uiRecordApi';

import getTodayAttendance from '@salesforce/apex/VisitController.getTodayAttendance';
import getTodayBeats from '@salesforce/apex/VisitController.getTodayBeats';
import getVisitsByBeat from '@salesforce/apex/VisitController.getVisitsByBeat';
import getDayTimeline from '@salesforce/apex/VisitController.getDayTimeline';
import startDay from '@salesforce/apex/VisitController.startDay';
import endDay from '@salesforce/apex/VisitController.endDay';

const USER_FIELDS = ['User.Name'];
const DATE_WINDOW_SIZE = 5;
const DEFAULT_DATE_WINDOW_OFFSET = -2;
const formatDateValue = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export default class r_fieldDayHome extends NavigationMixin(LightningElement) {

    /* =====================
       STATE
    ====================== */
    @track userName;
    @track visits = [];
    @track beats = [];

    @track selectedBeatId = null;
    @track selectedBeatName = null;
    @track showBeatDropdown = false;

    selectedDate = formatDateValue(new Date());

    viewMode = null; // null | 'BEAT' | 'DAY'
    dayStarted = false;
    dayEnded = false;
    isToday = true;
    summaryPulse = false;
    _summaryPulseTimeout;
    _lastSummary = { completed: 0, inProgress: 0, pending: 0 };
    dateWindowOffset = DEFAULT_DATE_WINDOW_OFFSET;
    dateWindowSize = DATE_WINDOW_SIZE;
    timelineOpen = false;
    timelineVisits = [];
    timelineLoading = false;

    /* =====================
       USER
    ====================== */
    @wire(getRecord, { recordId: USER_ID, fields: USER_FIELDS })
    wiredUser({ data }) {
        if (data) {
            this.userName = data.fields.Name.value;
        }
    }

    /* =====================
       INIT
    ====================== */
    connectedCallback() {
        this.loadAttendance();
        this.loadBeats();
    }

    /* =====================
       LOADERS
    ====================== */
    loadAttendance() {
        getTodayAttendance()
            .then(att => {
                this.dayStarted = !!att;
                this.dayEnded = !!att?.End_Time__c;
            });
    }

    loadBeats() {
        return getTodayBeats({ visitDate: this.selectedDate })
            .then(r => {
                this.beats = (r || []).map(beat => {
                    const startDay = beat.ibfsa__Start_Date__c || beat.Start_Date__c;
                    const endDay = beat.ibfsa__End_Date__c || beat.End_Date__c;
                    return {
                        ...beat,
                        startDay,
                        endDay,
                        rangeLabel: startDay && endDay
                            ? `${startDay} - ${endDay}`
                            : startDay
                                ? `Start ${startDay}`
                                : endDay
                                    ? `End ${endDay}`
                                    : null
                    };
                });

                const stillValid = this.beats.some(beat => beat.Id === this.selectedBeatId);
                if (!stillValid) {
                    this.selectedBeatId = null;
                    this.selectedBeatName = null;
                    this.viewMode = null;
                    this.applyVisits([], false);
                } else if (this.viewMode === 'BEAT') {
                    this.loadVisits();
                }
            })
            .catch(() => {
                this.beats = [];
            });
    }

    loadTimelinePopup() {
        this.timelineLoading = true;
        getDayTimeline({ visitDate: this.selectedDate })
            .then(r => {
                this.timelineVisits = r || [];
            })
            .catch(err => {
                this.timelineVisits = [];
                this.showToast(
                    'Unable to load timeline',
                    err?.body?.message || 'Please try again.',
                    'error'
                );
            })
            .finally(() => {
                this.timelineLoading = false;
            });
    }

    loadVisits() {
        if (!this.selectedBeatId) return;

        getVisitsByBeat({
            beatId: this.selectedBeatId,
            visitDate: this.selectedDate
        })
        .then(r => this.applyVisits(r));
    }

    /* =====================
       ACTIONS
    ====================== */
    handleTimelineClick() {
        this.timelineOpen = !this.timelineOpen;
        if (this.timelineOpen) {
            this.showBeatDropdown = false;
            this.loadTimelinePopup();
        }
    }

    handleBeatToggle() {
        this.showBeatDropdown = !this.showBeatDropdown;
    }

    handleBeatSelect(e) {
        this.selectedBeatId = e.currentTarget.dataset.id;
        this.selectedBeatName = e.currentTarget.dataset.name;
        this.showBeatDropdown = false;

        this.viewMode = 'BEAT';
        this.applyVisits([], false);
        this.loadVisits();
    }

    handleDateChange(e) {
        this.selectedDate = e.currentTarget.dataset.date;
        const today = formatDateValue(new Date());
        this.isToday = this.selectedDate === today;

        this.loadBeats();

        if (this.timelineOpen) {
            this.loadTimelinePopup();
        }
    }

    handleRefresh() {
        this.applyVisits([], false);
        setTimeout(() => {
            if (this.viewMode === 'BEAT') this.loadVisits();
            if (this.timelineOpen) this.loadTimelinePopup();
        }, 0);
    }

    handleOpenVisit(event) {
        const visitId = event.detail?.visit?.Id;
        if (!visitId) return;

        this[NavigationMixin.Navigate]({
            type: 'standard__component',
            attributes: {
                componentName: 'c__visitDetailPage'
            },
            state: {
                c__visitId: visitId
            }
        });
    }

    handleStartDay() {
        if (this.startDayDisabled) return;
        this.performDayAction(
            startDay,
            () => {
                this.dayStarted = true;
                this.dayEnded = false;
            },
            'Day started',
            'You are checked in for today.'
        );
    }

    handleEndDay() {
        if (this.endDayDisabled) return;
        this.performDayAction(
            endDay,
            () => {
                this.dayEnded = true;
            },
            'Day ended',
            'You are checked out for today.'
        );
    }

    performDayAction(apexMethod, onSuccess, title, message) {
        if (!navigator?.geolocation) {
            this.showToast('Location unavailable', 'Geolocation is not supported.', 'error');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            pos => {
                apexMethod({
                    lat: pos.coords.latitude.toString(),
                    lon: pos.coords.longitude.toString()
                })
                .then(() => {
                    if (onSuccess) onSuccess();
                    this.loadAttendance();
                    this.showToast(title, message, 'success');
                })
                .catch(err => {
                    this.showToast(
                        'Action failed',
                        err?.body?.message || 'Please try again.',
                        'error'
                    );
                });
            },
            () => this.showToast('Location required', 'Please enable location permission.', 'error'),
            { enableHighAccuracy: true }
        );
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }

    applyVisits(nextVisits, shouldPulse = true) {
        this.visits = [...nextVisits];
        if (shouldPulse) {
            this.pulseSummaryIfChanged();
        }
    }

    pulseSummaryIfChanged() {
        const next = {
            completed: this.completedCount,
            inProgress: this.inProgressCount,
            pending: this.pendingCount
        };

        const changed = next.completed !== this._lastSummary.completed ||
            next.inProgress !== this._lastSummary.inProgress ||
            next.pending !== this._lastSummary.pending;

        this._lastSummary = next;

        if (!changed) return;

        this.summaryPulse = false;
        requestAnimationFrame(() => {
            this.summaryPulse = true;
            clearTimeout(this._summaryPulseTimeout);
            this._summaryPulseTimeout = setTimeout(() => {
                this.summaryPulse = false;
            }, 320);
        });
    }

    /* =====================
       GETTERS (UI)
    ====================== */
    get beatLabel() {
        return this.selectedBeatName || 'Select Beat';
    }

    get isBeatMode() {
        return this.viewMode === 'BEAT';
    }

    get isTimelineMode() {
        return this.viewMode === 'DAY';
    }

    get progressPercentage() {
        const completed = this.visits.filter(
            v => v.ibfsa__Visit_Status__c === 'Completed'
        ).length;

        return this.visits.length
            ? Math.round((completed / this.visits.length) * 100)
            : 0;
    }

    get progressStyle() {
        return `width: ${this.progressPercentage}%;`;
    }

    get totalVisits() {
        return this.visits.length;
    }

    get completedCount() {
        return this.visits.filter(
            v => v.ibfsa__Visit_Status__c === 'Completed'
        ).length;
    }

    get inProgressCount() {
        return this.visits.filter(
            v => v.ibfsa__Visit_Status__c === 'In Progress'
        ).length;
    }

    get pendingCount() {
        const total = this.visits.length;
        return Math.max(total - this.completedCount - this.inProgressCount, 0);
    }

    get startDayDisabled() {
        return !this.isToday || this.dayStarted || this.dayEnded;
    }

    get endDayDisabled() {
        return !this.isToday || !this.dayStarted || this.dayEnded;
    }

    get showStartDayButton() {
        return !this.dayStarted && !this.dayEnded;
    }

    get showEndDayButton() {
        return this.dayStarted && !this.dayEnded;
    }

    get showDayEndedButton() {
        return this.dayEnded;
    }

    get summaryCompletedClass() {
        return `summary-pill done${this.summaryPulse ? ' pulse' : ''}`;
    }

    get summaryProgressClass() {
        return `summary-pill progress${this.summaryPulse ? ' pulse' : ''}`;
    }

    get summaryPendingClass() {
        return `summary-pill pending${this.summaryPulse ? ' pulse' : ''}`;
    }

    get userInitials() {
        return this.userName
            ?.split(' ')
            .map(c => c[0])
            .join('');
    }

    get dateOptions() {
        const base = new Date();
        base.setDate(base.getDate() + this.dateWindowOffset);
        const todayVal = formatDateValue(new Date());

        return [...Array(this.dateWindowSize).keys()].map(i => {
            const d = new Date(base);
            d.setDate(base.getDate() + i);
            const val = formatDateValue(d);
            const isSelected = val === this.selectedDate;
            const isToday = val === todayVal;

            return {
                value: val,
                day: d.toLocaleDateString('en', { weekday: 'short' }),
                date: d.getDate(),
                class: `date-btn${isSelected ? ' active' : ''}${isToday ? ' today' : ''}`
            };
        });
    }

    handlePrevWindow() {
        this.dateWindowOffset -= this.dateWindowSize;
    }

    handleNextWindow() {
        this.dateWindowOffset += this.dateWindowSize;
    }

    handleTodayJump() {
        const today = formatDateValue(new Date());
        this.selectedDate = today;
        this.isToday = true;
        this.dateWindowOffset = DEFAULT_DATE_WINDOW_OFFSET;
        this.loadAttendance();
        this.loadBeats();

        if (this.timelineOpen) {
            this.loadTimelinePopup();
        }
    }
}
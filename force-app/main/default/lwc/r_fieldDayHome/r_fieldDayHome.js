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
import getTravelSummaryByDate from '@salesforce/apex/VisitController.getTravelSummaryByDate';

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
    travelSummary = {};
    travelLoading = false;
    travelError = null;
    activeScreen = 'operations';
    activeVisitTab = 'upcoming';
    dailyVisits = [];
    activeMainScreen = 'dashboard'; // dashboard | field

    
    manualExpenseType = 'Travel';
    manualExpenseAmount = '';
    manualExpenseRemark = '';
    manualExpenses = [];

    newProducts = [
        { id: 'np1', name: 'FreshMax Energy Drink 250ml', category: 'Beverage' },
        { id: 'np2', name: 'NutriBar Choco Almond', category: 'Snacks' },
        { id: 'np3', name: 'QuickWash Liquid 1L', category: 'Home Care' }
    ];

    activeSchemes = [
        { id: 'sc1', title: 'Retail Push', detail: 'Buy 20, Get 2', till: '28 Feb' },
        { id: 'sc2', title: 'Visibility Bonus', detail: 'Extra 3% on premium shelf', till: '25 Feb' },
        { id: 'sc3', title: 'New Outlet Starter', detail: 'Flat Rs 500 credit', till: '31 Mar' }
    ];

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
        this.loadTravelSummary();
        this.fetchDayTimelineData();
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

    loadTravelSummary() {
        this.travelLoading = true;
        this.travelError = null;
        getTravelSummaryByDate({ visitDate: this.selectedDate })
            .then(summary => {
                this.travelSummary = summary || {};
            })
            .catch(err => {
                this.travelSummary = {};
                this.travelError = err?.body?.message || 'Unable to load expense summary for selected date.';
            })
            .finally(() => {
                this.travelLoading = false;
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
                    this.activeMainScreen = 'dashboard';
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
        this.fetchDayTimelineData(true, true);
    }
    
    fetchDayTimelineData(showLoader = false, showErrorToast = false) {
        if (showLoader) {
            this.timelineLoading = true;
        }

        return getDayTimeline({ visitDate: this.selectedDate })
            .then(r => {
                const records = r || [];
                this.timelineVisits = records;
                this.dailyVisits = records;
            })
            .catch(err => {
                this.timelineVisits = [];
                this.dailyVisits = [];
                if (showErrorToast) {
                    this.showToast(
                        'Unable to load timeline',
                        err?.body?.message || 'Please try again.',
                        'error'
                    );
                }
            })
            .finally(() => {
                if (showLoader) {
                    this.timelineLoading = false;
                }
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

    handleScreenChange(event) {
        const nextScreen = event?.currentTarget?.dataset?.screen;
        if (!nextScreen || nextScreen === this.activeScreen) return;
        this.activeScreen = nextScreen;
        if (nextScreen !== 'operations') {
            this.timelineOpen = false;
            this.showBeatDropdown = false;
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
        this.activeMainScreen = 'field';
        this.activeScreen = 'operations';
        this.applyVisits([], false);
        this.loadVisits();
    }

    handleBackToDashboard() {
        this.activeMainScreen = 'dashboard';
        this.showBeatDropdown = false;
    }

    handleGenerateInsights() {
        this.showToast(
            'Insights ready',
            this.nextActionLine,
            'info'
        );
    }

    handleDateChange(e) {
        this.selectedDate = e.currentTarget.dataset.date;
        const today = formatDateValue(new Date());
        this.isToday = this.selectedDate === today;

        this.loadBeats();
        this.loadTravelSummary();
        this.fetchDayTimelineData();

        if (this.timelineOpen) {
            this.loadTimelinePopup();
        }
    }

    handleRefresh() {
        this.applyVisits([], false);
        this.loadTravelSummary();
        this.fetchDayTimelineData();
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
                    this.loadTravelSummary();
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

    handleExpenseFieldChange(event) {
        const field = event.target.dataset.field;
        const value = event.detail?.value ?? event.target.value;
        if (field === 'type') this.manualExpenseType = value;
        if (field === 'amount') this.manualExpenseAmount = value;
        if (field === 'remark') this.manualExpenseRemark = value;
    }

    handleAddExpense() {
        const amount = Number(this.manualExpenseAmount);
        if (!amount || amount <= 0) {
            this.showToast('Invalid amount', 'Enter a valid manual expense amount.', 'warning');
            return;
        }

        this.manualExpenses = [
            {
                id: `${Date.now()}`,
                type: this.manualExpenseType,
                amount,
                remark: this.manualExpenseRemark || 'No remarks',
                createdAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
                formattedAmount: this.formatINRCurrency(amount)
            },
            ...this.manualExpenses
        ];
        this.manualExpenseAmount = '';
        this.manualExpenseRemark = '';
        this.showToast('Expense added', 'Manual expense added for today.', 'success');
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
        return this.selectedBeatName || 'Select Beat for Today';
    }

    get firstName() {
        return this.userName?.split(' ')[0] || 'Sales Rep';
    }

    get beatOptions() {
        return (this.beats || []).map(beat => ({
            ...beat,
            rowClass: `beat-option${beat.Id === this.selectedBeatId ? ' selected' : ''}`,
            checkMark: beat.Id === this.selectedBeatId ? '✓' : ''
        }));
    }

    get effectiveDailyVisits() {
        return this.dailyVisits.length ? this.dailyVisits : this.visits;
    }

    get isBeatMode() {
        return this.viewMode === 'BEAT';
    }

    get isTimelineMode() {
        return this.viewMode === 'DAY';
    }

    get progressPercentage() {
        const completed = this.effectiveDailyVisits.filter(
            v => this.normalizeStatus(v.ibfsa__Visit_Status__c) === 'completed'
        ).length;

        return this.effectiveDailyVisits.length
            ? Math.round((completed / this.effectiveDailyVisits.length) * 100)
            : 0;
    }

    get progressStyle() {
        return `width: ${this.progressPercentage}%;`;
    }

    get totalVisits() {
        return this.effectiveDailyVisits.length;
    }

    get completedCount() {
        return this.effectiveDailyVisits.filter(
            v => this.normalizeStatus(v.ibfsa__Visit_Status__c) === 'completed'
        ).length;
    }

    get inProgressCount() {
        return this.effectiveDailyVisits.filter(
            v => this.normalizeStatus(v.ibfsa__Visit_Status__c) === 'in progress'
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

    get isOperationsScreen() {
        return this.activeScreen === 'operations';
    }

    get isTravelScreen() {
        return this.activeScreen === 'travel';
    }

    get operationsTabClass() {
        return `mode-btn${this.isOperationsScreen ? ' active' : ''}`;
    }

    get travelTabClass() {
        return `mode-btn${this.isTravelScreen ? ' active' : ''}`;
    }

    get todayDistanceKmLabel() {
        const value = this.travelSummary?.totalDistanceKm;
        return value === null || value === undefined ? '0.000 km' : `${Number(value).toFixed(3)} km`;
    }

    get eligibleDistanceKmLabel() {
        const value = this.travelSummary?.eligibleDistanceKm;
        return value === null || value === undefined ? '0.000 km' : `${Number(value).toFixed(3)} km`;
    }

    get estimatedExpenseLabel() {
        const value = this.travelSummary?.expenseAmount;
        return value === null || value === undefined ? 'Rs 0.00' : `Rs ${Number(value).toFixed(2)}`;
    }

    get travelStatusLabel() {
        return this.travelSummary?.status || 'Draft';
    }

    get selectedDateLabel() {
        if (!this.selectedDate) {
            return '';
        }
        const dateObj = new Date(`${this.selectedDate}T00:00:00`);
        return dateObj.toLocaleDateString('en-IN', {
            weekday: 'short',
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    }

    get showTravelError() {
        return !!this.travelError;
    }

    get salesTargetAmount() {
        const outlets = this.totalVisits || (this.beats.length * 4);
        return Math.max(outlets, 1) * 12000;
    }

    get salesAchievedAmount() {
        return (this.completedCount * 12000) + (this.inProgressCount * 6000);
    }

    get salesPendingAmount() {
        return Math.max(this.salesTargetAmount - this.salesAchievedAmount, 0);
    }

    get salesAchievementPercent() {
        return Math.min(100, Math.round((this.salesAchievedAmount / this.salesTargetAmount) * 100));
    }

    get salesProgressStyle() {
        return `width:${this.salesAchievementPercent}%`;
    }

    get formattedTargetAmount() {
        return this.formatINRCurrency(this.salesTargetAmount);
    }

    get formattedAchievedAmount() {
        return this.formatINRCurrency(this.salesAchievedAmount);
    }

    get formattedPendingAmount() {
        return this.formatINRCurrency(this.salesPendingAmount);
    }

    get incentiveTarget() {
        return Math.max(this.totalVisits, 1);
    }

    get incentiveAchieved() {
        return this.completedCount;
    }

    get incentivePercent() {
        return Math.min(100, Math.round((this.incentiveAchieved / this.incentiveTarget) * 100));
    }

    get incentiveProgressStyle() {
        return `width:${this.incentivePercent}%`;
    }

    get productivityScore() {
        if (!this.dayStarted) return 0;
        if (this.dayEnded) return 100;
        return Math.min(98, Math.max(35, this.progressPercentage + 32));
    }

    get beatCoverageLabel() {
        return `${this.completedCount + this.inProgressCount}/${Math.max(this.totalVisits, 0)}`;
    }

    get nextActionLine() {
        if (!this.dayStarted) return 'Start day to unlock beats and visit operations.';
        if (!this.selectedBeatId) return 'Select a beat to load your outlets and route.';
        if (!this.completedCount) return 'Complete your first outlet to build momentum.';
        if (!this.dayEnded) return 'Review expenses and close day after final visit.';
        return 'Day complete. Review performance and prepare tomorrow.';
    }

    get motivationLine() {
        const hour = new Date().getHours();
        if (!this.dayStarted) return 'Strong start wins the day. Check in and attack the first beat.';
        if (hour < 13) return 'Morning consistency drives target conversion.';
        if (hour < 17) return 'Push high value SKUs now to maximize incentive.';
        if (!this.dayEnded) return 'Finish strong: update final expenses and complete day-end.';
        return 'Great finish. Keep the same discipline tomorrow.';
    }

    get flowStartClass() {
        return `journey-step${this.dayStarted ? ' done' : ' active'}`;
    }

    get flowCockpitClass() {
        if (!this.dayStarted) return 'journey-step';
        if (this.selectedBeatId) return 'journey-step done';
        return 'journey-step active';
    }

    get flowBeatClass() {
        if (!this.dayStarted) return 'journey-step';
        if (this.selectedBeatId) return 'journey-step done';
        return 'journey-step active';
    }

    get flowVisitsClass() {
        if (!this.selectedBeatId) return 'journey-step';
        if (this.completedCount > 0) return 'journey-step done';
        return 'journey-step active';
    }

    get flowEndClass() {
        if (this.dayEnded) return 'journey-step done';
        if (this.dayStarted) return 'journey-step active';
        return 'journey-step';
    }

    get journeyStateLabel() {
        if (this.dayEnded) return 'Day Completed';
        if (this.dayStarted) return 'In Field';
        return 'Not Started';
    }

    get journeyStateClass() {
        if (this.dayEnded) return 'journey-state ended';
        if (this.dayStarted) return 'journey-state active';
        return 'journey-state';
    }

    get expenseTypeOptions() {
        return [
            { label: 'Travel', value: 'Travel' },
            { label: 'Meal', value: 'Meal' },
            { label: 'Parking', value: 'Parking' },
            { label: 'Miscellaneous', value: 'Miscellaneous' }
        ];
    }

    get hasManualExpenses() {
        return this.manualExpenses.length > 0;
    }

    get manualExpenseTotalLabel() {
        const total = this.manualExpenses.reduce((sum, item) => sum + item.amount, 0);
        return this.formatINRCurrency(total);
    }

    get expenseSnapshotLabel() {
        const autoExpense = Number(this.travelSummary?.expenseAmount || 0);
        const manualExpense = this.manualExpenses.reduce((sum, item) => sum + item.amount, 0);
        return this.formatINRCurrency(autoExpense + manualExpense);
    }

    get performanceLiftPercent() {
        if (!this.dayStarted) return 0;
        return Math.min(35, Math.max(8, this.progressPercentage - 5));
    }

    get incentiveCurrentLabel() {
        return this.formatINRCurrency(this.salesAchievedAmount);
    }

    get incentiveTargetLabel() {
        return this.formatINRCurrency(this.salesTargetAmount);
    }

    get incentiveFloorLabel() {
        return this.formatINRCurrency(Math.round(this.salesTargetAmount * 0.38));
    }

    get incentiveMidLabel() {
        return this.formatINRCurrency(Math.round(this.salesTargetAmount * 0.64));
    }

    get segmentWidthA() {
        return Math.max(18, Math.round(this.salesAchievementPercent * 0.42));
    }

    get segmentWidthB() {
        return Math.max(22, Math.round(100 - (this.salesAchievementPercent * 0.26)));
    }

    get salesSegmentAStyle() {
        return `width:${Math.min(this.segmentWidthA, 60)}%`;
    }

    get salesSegmentBStyle() {
        return `width:${Math.min(this.segmentWidthB, 65)}%`;
    }

    get salesSegmentCStyle() {
        const width = Math.max(10, 100 - this.segmentWidthA - this.segmentWidthB);
        return `width:${width}%`;
    }

    get upcomingTabClass() {
        return `task-tab${this.activeVisitTab === 'upcoming' ? ' active' : ''}`;
    }

    get ongoingTabClass() {
        return `task-tab${this.activeVisitTab === 'ongoing' ? ' active' : ''}`;
    }

    get completedTabClass() {
        return `task-tab${this.activeVisitTab === 'completed' ? ' active' : ''}`;
    }

    get filteredVisits() {
        const visits = this.visits || [];
        if (this.activeVisitTab === 'ongoing') {
            return visits.filter(v => this.normalizeStatus(v.ibfsa__Visit_Status__c) === 'in progress');
        }
        if (this.activeVisitTab === 'completed') {
            return visits.filter(v => this.normalizeStatus(v.ibfsa__Visit_Status__c) === 'completed');
        }
        return visits.filter(v => {
            const status = this.normalizeStatus(v.ibfsa__Visit_Status__c);
            return status !== 'in progress' && status !== 'completed';
        });
    }

    get userInitials() {
        return this.userName
            ?.split(' ')
            .map(c => c[0])
            .join('') || 'SR';
    }

    get isDashboardScreen() {
        return this.activeMainScreen === 'dashboard';
    }

    get isFieldScreen() {
        return this.activeMainScreen === 'field';
    }

    get currentMonthLabel() {
        return new Date().toLocaleDateString('en-IN', {
            month: 'long'
        });
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
        this.loadTravelSummary();
        this.loadBeats();
        this.fetchDayTimelineData();

        if (this.timelineOpen) {
            this.loadTimelinePopup();
        }
    }

    handleVisitTabChange(event) {
        const tab = event?.currentTarget?.dataset?.tab;
        if (!tab || tab === this.activeVisitTab) return;
        this.activeVisitTab = tab;
    }

    normalizeStatus(value) {
        return (value || '').trim().toLowerCase();
    }

    formatINRCurrency(value) {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(value || 0);
    }
}
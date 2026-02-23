/**
 * beatPlanWeekly.js
 *
 * REAL SCHEMA  (ibfsa__ package)
 * ──────────────────────────────────────────────────────────────────────
 *
 *   ibfsa__Beat__c            — weekly plan header
 *     ibfsa__Sales_Rep__c     — rep lookup
 *     ibfsa__Start_Date__c    — plan start (Monday)
 *     ibfsa__End_Date__c      — plan end   (Sunday)
 *     ibfsa__Status__c        — Active / Submitted / Approved / Rejected
 *     ibfsa__Active__c        — boolean
 *
 *   ibfsa__Visit__c           — one visit per outlet per day
 *     ibfsa__Beat__c          — parent Beat lookup
 *     ibfsa__Outlet1__c       — Account lookup  (the outlet/store)
 *     ibfsa__Visit_Date__c    — Date
 *     ibfsa__Planned_Start_Time__c  — DateTime
 *     ibfsa__Planned_End_Time__c    — DateTime
 *     ibfsa__Visit_Status__c        — Planned / In Progress / Missed
 *     ibfsa__Approval_Status__c     — Planned / Pending Approval / Approved
 *     ibfsa__Is_Completed__c        — boolean
 *     ibfsa__Sequence__c            — Number (visit order in day)
 *
 *   Account (outlet)
 *     ibfsa__Beat__c              — direct Beat lookup on Account
 *     ibfsa__Outlet_Priority__c   — priority picklist
 *
 * APEX METHODS
 * ──────────────────────────────────────────────────────────────────────
 *   getWeeklyVisits(anchorDate)   → WeekData { stats, visits[] }
 *   submitBeatPlan(beatId)        → 'SUCCESS'
 *   getBeatForWeek(anchorDate)    → ibfsa__Beat__c Id | null
 *   saveVisit(visitJson)          → ibfsa__Visit__c Id
 */

import { LightningElement, track }  from 'lwc';
import { NavigationMixin }          from 'lightning/navigation';
import { ShowToastEvent }           from 'lightning/platformShowToastEvent';

import getWeeklyVisits  from '@salesforce/apex/BeatPlanController.getWeeklyVisits';
import submitBeatPlan   from '@salesforce/apex/BeatPlanController.submitBeatPlan';
import getBeatForWeek   from '@salesforce/apex/BeatPlanController.getBeatForWeek';

// ── Constants ─────────────────────────────────────────────────────────────────
const DAY_KEYS  = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const DAY_NAMES = { MON:'Mon', TUE:'Tue', WED:'Wed', THU:'Thu', FRI:'Fri', SAT:'Sat', SUN:'Sun' };

// Card background CSS — keyed to Apex colorClass (from statusToColor helper)
const CARD_CSS = {
    'card-completed'  : 'bp-card bp-card--completed',
    'card-missed'     : 'bp-card bp-card--missed',
    'card-inprogress' : 'bp-card bp-card--inprogress',
    'card-planned'    : 'bp-card bp-card--planned'
};

// Visit status pill CSS
const VISIT_STATUS_CSS = {
    'Planned'       : 'bp-pill bp-pill--planned',
    'In Progress'   : 'bp-pill bp-pill--inprogress',
    'Missed'        : 'bp-pill bp-pill--missed',
    'Completed'     : 'bp-pill bp-pill--completed'
};

// Approval status pill CSS  (ibfsa__Approval_Status__c)
const APPROVAL_CSS = {
    'Planned'           : 'bp-pill bp-pill--planned',
    'Pending Approval'  : 'bp-pill bp-pill--pending',
    'Approved'          : 'bp-pill bp-pill--completed',
    'Rejected'          : 'bp-pill bp-pill--missed'
};

// Beat status badge CSS  (ibfsa__Beat__c.ibfsa__Status__c)
const BEAT_STATUS_CSS = {
    'Active'    : 'bp-beat-badge bp-beat-badge--active',
    'Submitted' : 'bp-beat-badge bp-beat-badge--submitted',
    'Approved'  : 'bp-beat-badge bp-beat-badge--approved',
    'Rejected'  : 'bp-beat-badge bp-beat-badge--rejected',
    'Inactive'  : 'bp-beat-badge bp-beat-badge--inactive'
};

export default class BeatPlanWeekly extends NavigationMixin(LightningElement) {

    // ── State ─────────────────────────────────────────────────────────────────
    @track anchorDate    = new Date();
    @track stats         = null;      // WeekStats from Apex
    @track visits        = [];        // enriched VisitWrapper[]
    @track isLoading     = false;
    @track showModal     = false;
    @track showSuccess   = false;
    @track selectedVisit = null;

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    connectedCallback() {
        this.loadWeek();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DATA
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Calls getWeeklyVisits(anchorDate).
     * Apex finds the active ibfsa__Beat__c for this rep + week,
     * then fetches ibfsa__Visit__c children with ibfsa__Outlet1__r (Account).
     */
    async loadWeek() {
        this.isLoading = true;
        try {
            const data   = await getWeeklyVisits({ anchorDate: this._isoDate(this.anchorDate) });
            this.stats   = data.stats;
            this.visits  = (data.visits || []).map(v => this._enrich(v));
        } catch (err) {
            this._error('Failed to load visits', err);
        } finally {
            this.isLoading = false;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // COMPUTED PROPERTIES
    // ─────────────────────────────────────────────────────────────────────────

    /** "Feb 11 – Feb 17"  from Apex WeekStats.weekLabel */
    get weekLabel() {
        return this.stats?.weekLabel ?? this._localWeekLabel();
    }

    /** ibfsa__Beat__c.Name */
    get beatName() {
        return this.stats?.beatName ?? null;
    }

    /** ibfsa__Beat__c.ibfsa__Status__c */
    get beatStatus() {
        return this.stats?.beatStatus ?? null;
    }

    /** CSS badge for ibfsa__Beat__c.ibfsa__Status__c */
    get beatStatusCls() {
        return BEAT_STATUS_CSS[this.stats?.beatStatus] ?? 'bp-beat-badge';
    }

    /**
     * Submit disabled when:
     *  - No active Beat for this week
     *  - Beat already Submitted or Approved
     *  - Loading
     */
    get isSubmitDisabled() {
        if (this.isLoading) return true;
        const s = this.stats?.beatStatus;
        return !s || s === 'Submitted' || s === 'Approved';
    }

    /** Show "No Beat" panel when Apex returned no Beat and not loading */
    get showNoBeat() {
        return !this.isLoading && !this.stats?.beatId;
    }

    /** True when Beat exists but has zero visits */
    get isEmpty() {
        return !this.isLoading && !!this.stats?.beatId && this.visits.length === 0;
    }

    /**
     * Day column headers.
     * [ { key:'MON', abbr:'Mon', dateNum:11, cls:'bp-dh' }, … ]
     */
    get dayHeaders() {
        const mon = this._mondayOf(this.anchorDate);
        return DAY_KEYS.map((key, i) => {
            const d = new Date(mon);
            d.setDate(d.getDate() + i);
            const today = this._sameDay(d, new Date());
            return {
                key,
                abbr    : DAY_NAMES[key],
                dateNum : d.getDate(),
                cls     : `bp-dh${today ? ' bp-dh--today' : ''}`
            };
        });
    }

    /**
     * Calendar grid: N rows × 7 columns.
     * Each row is an array of 7 cells; each cell holds visit | null.
     * Visits are sorted by ibfsa__Sequence__c then ibfsa__Planned_Start_Time__c
     * (already ordered by Apex).
     */
    get calendarRows() {
        const byDay = {};
        DAY_KEYS.forEach(k => (byDay[k] = []));
        this.visits.forEach(v => {
            if (byDay[v.dayOfWeek]) byDay[v.dayOfWeek].push(v);
        });

        const maxRows = Math.max(1, ...DAY_KEYS.map(k => byDay[k].length));

        return Array.from({ length: maxRows }, (_, ri) => ({
            rowIndex : ri,
            cells    : DAY_KEYS.map(key => ({
                cellKey : `${key}-${ri}`,
                visit   : byDay[key][ri] ?? null
            }))
        }));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // HANDLERS
    // ─────────────────────────────────────────────────────────────────────────

    handlePrevWeek() {
        this.anchorDate = new Date(this.anchorDate);
        this.anchorDate.setDate(this.anchorDate.getDate() - 7);
        this.loadWeek();
    }

    handleNextWeek() {
        this.anchorDate = new Date(this.anchorDate);
        this.anchorDate.setDate(this.anchorDate.getDate() + 7);
        this.loadWeek();
    }

    handleDayClick(event) {
        // Future: open Add Visit pre-filled with this day
        console.log('[BeatPlan] Day clicked:', event.currentTarget.dataset.day);
    }

    handleVisitClick(event) {
        const id    = event.currentTarget.dataset.id;
        const visit = this.visits.find(v => v.id === id);
        if (visit) {
            this.selectedVisit = visit;
            this.showModal     = true;
        }
    }

    handleCloseModal() {
        this.showModal     = false;
        this.selectedVisit = null;
    }

    /**
     * Navigate to Account record.
     * outletId = ibfsa__Visit__c.ibfsa__Outlet1__c  (Account lookup on Visit)
     */
    handleViewOutlet() {
        if (!this.selectedVisit?.outletId) return;
        this[NavigationMixin.Navigate]({
            type       : 'standard__recordPage',
            attributes : { recordId: this.selectedVisit.outletId, actionName: 'view' }
        });
    }

    /**
     * Add Visit:
     *  1. getBeatForWeek() → ibfsa__Beat__c.Id for this rep + week
     *  2. Navigate to ibfsa__Visit__c new record page with Beat pre-filled.
     *     User selects Account from ibfsa__Outlet1__c lookup on the Visit form.
     */
    async handleAddVisit() {
        try {
            const beatId = await getBeatForWeek({ anchorDate: this._isoDate(this.anchorDate) });

            if (!beatId) {
                this._error('No Beat Plan', { message: 'No active Beat Plan for this week. Contact your manager.' });
                return;
            }

            this[NavigationMixin.Navigate]({
                type       : 'standard__objectPage',
                attributes : {
                    objectApiName : 'ibfsa__Visit__c',
                    actionName    : 'new'
                },
                state : {
                    // Pre-fill ibfsa__Beat__c lookup on the new Visit form
                    defaultFieldValues : `ibfsa__Beat__c=${beatId}`
                }
            });
        } catch (err) {
            this._error('Could not open Add Visit', err);
        }
    }

    /**
     * Submit Beat Plan:
     *  Calls submitBeatPlan(beatId) with ibfsa__Beat__c.Id from stats.
     *  Apex sets Beat.ibfsa__Status__c = 'Submitted' and bulk-updates visits.
     */
    async handleSubmit() {
        const beatId = this.stats?.beatId;
        if (!beatId) return;

        this.isLoading = true;
        try {
            await submitBeatPlan({ beatId });

            this.showSuccess = true;
            setTimeout(() => { this.showSuccess = false; }, 3500);

            this.dispatchEvent(new ShowToastEvent({
                title  : 'Beat Plan Submitted',
                message: 'Sent for manager approval.',
                variant: 'success'
            }));

            await this.loadWeek();
        } catch (err) {
            this._error('Submission failed', err);
        } finally {
            this.isLoading = false;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PRIVATE HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Enrich a raw VisitWrapper from Apex with computed CSS and display fields.
     *
     * colorClass   → from Apex statusToColor(ibfsa__Visit_Status__c, ibfsa__Is_Completed__c)
     * outletName   → ibfsa__Outlet1__r.Name  (Account on Visit)
     * beatName     → ibfsa__Beat__r.Name
     * showBadge    → hide badge only when completed (green card speaks for itself)
     */
    _enrich(v) {
        return {
            ...v,
            cardCls          : CARD_CSS[v.colorClass]           ?? CARD_CSS['card-planned'],
            visitStatusCls   : VISIT_STATUS_CSS[v.visitStatus]  ?? 'bp-pill',
            approvalStatusCls: APPROVAL_CSS[v.approvalStatus]   ?? 'bp-pill',
            showBadge        : !v.isCompleted,
            formattedDate    : v.visitDate
                ? new Date(v.visitDate).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric'
                  })
                : ''
        };
    }

    _localWeekLabel() {
        const mon = this._mondayOf(this.anchorDate);
        const sun = new Date(mon);
        sun.setDate(sun.getDate() + 6);
        const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `${fmt(mon)} – ${fmt(sun)}`;
    }

    _mondayOf(d) {
        const dt   = new Date(d);
        const day  = dt.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        dt.setDate(dt.getDate() + diff);
        return dt;
    }

    _isoDate(d) {
        return d.toISOString().split('T')[0];
    }

    _sameDay(a, b) {
        return a.getFullYear() === b.getFullYear()
            && a.getMonth()    === b.getMonth()
            && a.getDate()     === b.getDate();
    }

    _error(title, err) {
        const msg = err?.body?.message || err?.message || 'Unexpected error.';
        this.dispatchEvent(new ShowToastEvent({ title, message: msg, variant: 'error' }));
    }
}
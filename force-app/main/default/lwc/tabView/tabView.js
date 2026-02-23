import { LightningElement, api } from 'lwc';

export default class TabView extends LightningElement {
    @api tabsConfig = '[{"id":"tab1","label":"New Products"},{"id":"tab2","label":"Schemes"}]';
    
    activeTab = 'tab1';
    tabs = [];

    connectedCallback() {
        this.initializeTabs();
    }

    @api
    get tabConfiguration() {
        return this.tabsConfig;
    }

    set tabConfiguration(value) {
        this.tabsConfig = value;
        this.initializeTabs();
    }

    get tab1IsActive() {
        return this.activeTab === 'tab1' ? 'active' : 'hidden';
    }

    get tab2IsActive() {
        return this.activeTab === 'tab2' ? 'active' : 'hidden';
    }

    get tab3IsActive() {
        return this.activeTab === 'tab3' ? 'active' : 'hidden';
    }

    get tab4IsActive() {
        return this.activeTab === 'tab4' ? 'active' : 'hidden';
    }

    get tab5IsActive() {
        return this.activeTab === 'tab5' ? 'active' : 'hidden';
    }

    initializeTabs() {
        try {
            const tabsData = JSON.parse(this.tabsConfig);
            
            if (!Array.isArray(tabsData)) {
                console.error('tabsConfig must be a valid JSON array');
                return;
            }

            // Limit to 5 tabs max
            const limitedTabs = tabsData.slice(0, 5);

            this.tabs = limitedTabs.map((tab, index) => ({
                id: tab.id || `tab${index + 1}`,
                label: tab.label || `Tab ${index + 1}`,
                isActive: (tab.id || `tab${index + 1}`) === this.activeTab ? 'active' : 'hidden'
            }));
        } catch (error) {
            console.error('Error parsing tabsConfig:', error);
        }
    }

    handleTabClick(event) {
        const tabId = event.currentTarget.dataset.tab;
        this.activeTab = tabId;

        // Update active states
        this.tabs = this.tabs.map(tab => ({
            ...tab,
            isActive: tab.id === tabId ? 'active' : 'hidden'
        }));

        // Dispatch custom event for parent components
        this.dispatchEvent(new CustomEvent('tabchange', {
            detail: { activeTab: tabId },
            bubbles: true,
            composed: true
        }));
    }
}
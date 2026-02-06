({
    onInit: function (component) {
        var pageRef = component.get("v.pageReference");
        if (pageRef && pageRef.state && pageRef.state.c__visitId) {
            component.set("v.visitId", pageRef.state.c__visitId);
        }
    },

    onPageRefChange: function (component) {
        var pageRef = component.get("v.pageReference");
        if (pageRef && pageRef.state && pageRef.state.c__visitId) {
            component.set("v.visitId", pageRef.state.c__visitId);
        }
    }
})
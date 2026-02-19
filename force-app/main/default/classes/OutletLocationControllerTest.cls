@IsTest
private class OutletLocationControllerTest {

    private class ReverseGeocodeMock implements HttpCalloutMock {
        public HTTPResponse respond(HTTPRequest req) {
            HttpResponse res = new HttpResponse();
            res.setStatusCode(200);
            // minimal payload with display_name as used by controller
            res.setBody('{"display_name":"221B Baker Street, London"}');
            return res;
        }
    }


    @IsTest
    static void testSaveOutletLocation_success() {
        Account outlet = TestDataFactory.createAccount('Outlet Geo', 'Franchise');

        Test.setMock(HttpCalloutMock.class, new ReverseGeocodeMock());

        Test.startTest();
        OutletLocationController.saveOutletLocation(outlet.Id, 51.523771, -0.158539);
        Test.stopTest();

        Account refreshed = [
            SELECT ShippingStreet,
                   ibfsa__Outlet_Location__Latitude__s,
                   ibfsa__Outlet_Location__Longitude__s
            FROM Account WHERE Id = :outlet.Id
        ];
        System.assertEquals(Decimal.valueOf('51.523771'), refreshed.ibfsa__Outlet_Location__Latitude__s, 'Latitude set');
        System.assertEquals(Decimal.valueOf('-0.158539'), refreshed.ibfsa__Outlet_Location__Longitude__s, 'Longitude set');
        System.assertEquals('221B Baker Street, London', refreshed.ShippingStreet, 'ShippingStreet set from reverse geocode');
    }

    @IsTest
    static void testSaveOutletLocation_outletValidation() {
        // Null outlet id
        Test.startTest();
        try {
            OutletLocationController.saveOutletLocation(null, 10, 10);
            System.assert(false, 'Expected AuraHandledException for null outletId');
        } catch (AuraHandledException e) {
            System.assert(true, 'Exception was thrown as expected');
        }
        Test.stopTest();
    }

    //     // Null coords
    //     try {
    //         OutletLocationController.saveOutletLocation(outlet.Id, null, 10);
    //         System.assert(false, 'Expected AuraHandledException for null latitude');
    //     } catch (AuraHandledException e) {
    //         System.assert(e.getMessage().contains('Outlet Id and coordinates required'), 'Validation message expected');
    //     }
    // }
}
export const FIXTURE_RISPOSTA = JSON.stringify({
  totalResults: 2,
  results: [
    {
      url: 'https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/TEST-CALL-01',
      metadata: {
        title: ['Test call for gaming innovation'],
        identifier: ['TEST-CALL-01'],
        status: ['31094502'],
        startDate: ['2026-01-01T00:00:00.000+0000'],
        deadlineDate: ['2026-12-31T00:00:00.000+0000'],
        deadlineModel: ['single-stage'],
        descriptionByte: ['<p>Expected Outcome: this is a test description about gaming.</p>'],
      },
    },
    {
      url: 'https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/TEST-CALL-02',
      metadata: {
        title: ['Test call without description'],
        identifier: ['TEST-CALL-02'],
        status: ['31094501'],
        startDate: ['2026-02-01T00:00:00.000+0000'],
        deadlineDate: ['2027-01-15T00:00:00.000+0000'],
        deadlineModel: ['single-stage'],
      },
    },
  ],
});

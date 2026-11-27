// The three notices are different confirmed stages of the same shipping restriction.
const passageNotices = new Map([
  ['m1-strait', 1],
  ['w1-convoy', 2],
  ['f2-strait-renewal', 3],
]);

// Reporting outlets can publish different stories about a single release.
export function eventIdentity(event) {
  const passageStage = passageNotices.get(event.id);
  const eventId = event.development?.id ?? (passageStage ? 'eunmok-passage' : event.id);
  const eventVersion = event.development?.version ?? passageStage ?? 1;
  return {eventId, eventVersion, releaseId:eventId + '/' + eventVersion, publishedTick:event.tick};
}

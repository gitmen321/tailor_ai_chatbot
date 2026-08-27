/** User asked for video/tutorial content, or a how-to question that needs a video. */
export function userWantsVideos(text) {
  const t = String(text || "").toLowerCase();

  if (
    /youtube|youtu\.be|വീഡിയോ|video|tutorial|ട്യൂട്ടോറിയൽ|ട്യൂട്ടോരിയൽ|കാണിക്ക|ചാനൽ|watch/i.test(
      t
    )
  ) {
    return true;
  }

  // How-to / repair / machine-operation questions — show tutorial videos even without "വീഡിയോ".
  return /എങ്ങനെ|മോട്ടോർ|ബെൽറ്റ്|ഓയിൽ|നാഡ്|താലി|ഫിറ്റ്|ഘടിപ്പി|തകരാർ|പ്രശ്നം|പഠിപ്പി|കാണിച്ചു|നിർദ്ദേശ/i.test(
      t
    ) ||
    /\b(how to|install|repair|fix|motor|belt|oil|thread|needle|stitch)\b/i.test(t);
}

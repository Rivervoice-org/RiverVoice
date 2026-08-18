pub trait AudioFilter: Send {
    fn name(&self) -> &'static str;

    fn start(&mut self, sample_rate: u32);

    fn apply(&mut self, samples: &mut [i16]);
}
